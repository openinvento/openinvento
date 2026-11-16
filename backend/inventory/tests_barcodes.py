import csv
import importlib
import io
import json
import zipfile

from django.apps import apps
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from account_auth.models import CustomUser

from .barcodes import BarcodeKind, detect_kind, gtin_is_valid, isbn_is_valid, normalize, pzn_is_valid
from .category_defaults import ensure_default_categories
from .export_utils import generate_inventory_csv_export
from .models import ArticleCategory, ArticleFieldValue, Barcode, CategoryField, Inventory, InventoryEntry

move_barcode_fields = importlib.import_module("inventory.migrations.0019_move_barcode_fields").move_barcode_fields


class CheckDigitTests(SimpleTestCase):
	def test_gtin(self):
		for value in ("4006381333931", "036000291452", "96385074", "10614141000415"):
			with self.subTest(value=value):
				self.assertTrue(gtin_is_valid(value))
		for value in ("4006381333932", "400638133393", "abc", ""):
			with self.subTest(value=value):
				self.assertFalse(gtin_is_valid(value))

	def test_isbn(self):
		for value in ("9780306406157", "0306406152", "080442957X"):
			with self.subTest(value=value):
				self.assertTrue(isbn_is_valid(value))
		# 4006381333931 is a valid EAN, but not an ISBN.
		for value in ("9780306406158", "0306406153", "4006381333931"):
			with self.subTest(value=value):
				self.assertFalse(isbn_is_valid(value))

	def test_pzn(self):
		for value in ("08585997", "4908802"):
			with self.subTest(value=value):
				self.assertTrue(pzn_is_valid(value))
		for value in ("08585998", "123"):
			with self.subTest(value=value):
				self.assertFalse(pzn_is_valid(value))

	def test_normalize_drops_separators_and_the_pzn_prefix(self):
		self.assertEqual(normalize(BarcodeKind.ISBN, "978-0-306-40615-7"), "9780306406157")
		self.assertEqual(normalize(BarcodeKind.ISBN, "080442957x"), "080442957X")
		self.assertEqual(normalize(BarcodeKind.PZN, "-08585997"), "08585997")
		self.assertEqual(normalize(BarcodeKind.PZN, "PZN-08585997"), "08585997")
		self.assertEqual(normalize(BarcodeKind.OTHER, "  A-1 b "), "A-1 b")

	def test_detect_kind(self):
		self.assertEqual(detect_kind("978-0-306-40615-7"), BarcodeKind.ISBN)
		self.assertEqual(detect_kind("0306406152"), BarcodeKind.ISBN)
		self.assertEqual(detect_kind("4006381333931"), BarcodeKind.EAN)
		self.assertEqual(detect_kind("96385074"), BarcodeKind.EAN)
		self.assertEqual(detect_kind("SN-1234"), BarcodeKind.OTHER)


class BarcodeApiTests(TestCase):
	def setUp(self):
		self.user = CustomUser.objects.create_user(username="owner", password="StrongPassword!123")
		self.inventory = Inventory.objects.create(name="Home")
		self.inventory.users.add(self.user)
		self.client = APIClient()
		self.client.force_login(self.user)

	def create_article(self, barcodes, **extra):
		return self.client.post(
			"/api/entries/",
			{"type": "article", "name": "Tea", "inventory": str(self.inventory.uuid), "barcodes_input": barcodes, **extra},
			format="json",
		)

	def test_barcodes_are_saved_with_detected_types(self):
		response = self.create_article([
			{"value": "4006381333931"},
			{"value": "978-0-306-40615-7"},
			{"kind": "pzn", "value": "-08585997"},
			{"kind": "other", "value": "Shop 42"},
		])

		self.assertEqual(response.status_code, 201, response.data)
		self.assertEqual(response.data["barcodes"], [
			{"kind": "ean", "value": "4006381333931"},
			{"kind": "isbn", "value": "9780306406157"},
			{"kind": "pzn", "value": "08585997"},
			{"kind": "other", "value": "Shop 42"},
		])

	def test_wrong_check_digit_is_rejected(self):
		for barcodes in ([{"value": "4006381333932"}], [{"kind": "pzn", "value": "08585998"}]):
			with self.subTest(barcodes=barcodes):
				response = self.create_article(barcodes)

				self.assertEqual(response.status_code, 400)
				self.assertIn("Other", str(response.data["barcodes_input"]))

	def test_duplicates_and_unknown_types_are_rejected(self):
		self.assertEqual(self.create_article([{"value": "4006381333931"}, {"value": "4006 3813 33931"}]).status_code, 400)
		self.assertEqual(self.create_article([{"kind": "upc", "value": "036000291452"}]).status_code, 400)
		self.assertEqual(self.create_article({"value": "4006381333931"}).status_code, 400)

	def test_update_replaces_the_list_and_leaves_it_alone_without_input(self):
		entry_id = self.create_article([{"value": "4006381333931"}]).data["uuid"]

		renamed = self.client.patch(f"/api/entries/{entry_id}/", {"name": "Green tea"}, format="json")
		self.assertEqual(renamed.data["barcodes"], [{"kind": "ean", "value": "4006381333931"}])

		replaced = self.client.patch(f"/api/entries/{entry_id}/", {"barcodes_input": [{"value": "96385074"}]}, format="json")
		self.assertEqual(replaced.data["barcodes"], [{"kind": "ean", "value": "96385074"}])

		cleared = self.client.patch(f"/api/entries/{entry_id}/", {"barcodes_input": []}, format="json")
		self.assertEqual(cleared.data["barcodes"], [])

	def test_multipart_form_sends_the_list_as_json(self):
		entry_id = self.create_article([]).data["uuid"]

		response = self.client.patch(
			f"/api/entries/{entry_id}/",
			{"barcodes_input": json.dumps([{"value": "4006381333931"}])},
			format="multipart",
		)

		self.assertEqual(response.status_code, 200, response.data)
		self.assertEqual(response.data["barcodes"], [{"kind": "ean", "value": "4006381333931"}])

	def test_any_entry_type_can_have_barcodes(self):
		area = InventoryEntry.objects.create(inventory=self.inventory, type="area", name="Study")

		response = self.client.post(
			"/api/entries/",
			{"type": "box", "name": "Crate", "inventory": str(self.inventory.uuid), "parent": str(area.uuid),
			 "barcodes_input": [{"value": "4006381333931"}]},
			format="json",
		)

		self.assertEqual(response.status_code, 201, response.data)
		self.assertEqual(response.data["barcodes"], [{"kind": "ean", "value": "4006381333931"}])

	def test_the_same_barcode_can_be_on_several_entries(self):
		self.assertEqual(self.create_article([{"value": "4006381333931"}]).status_code, 201)
		self.assertEqual(self.create_article([{"value": "4006381333931"}]).status_code, 201)

	def test_csv_export_contains_the_barcodes(self):
		self.create_article([{"value": "4006381333931"}])

		with zipfile.ZipFile(generate_inventory_csv_export(self.inventory)) as archive:
			rows = list(csv.DictReader(io.StringIO(archive.read("entries.csv").decode("utf-8-sig"))))

		self.assertEqual(json.loads(rows[0]["barcodes"]), [{"kind": "ean", "value": "4006381333931"}])


class MoveBarcodeFieldsTests(TestCase):
	def setUp(self):
		self.inventory = Inventory.objects.create(name="Home")
		self.article = InventoryEntry.objects.create(inventory=self.inventory, type="article", name="Thing")

	def old_field(self, category_name, key):
		category = ArticleCategory.objects.get(inventory=self.inventory, name=category_name)
		return CategoryField.objects.create(inventory=self.inventory, category=category, key=key, label=key, field_type="barcode")

	def set_value(self, field, value, entry=None):
		entry = entry or InventoryEntry.objects.create(inventory=self.inventory, type="article", name=f"Article {value!r}")
		ArticleFieldValue.objects.create(entry=entry, field=field, value=value)
		return entry

	def test_values_move_into_the_table_and_the_fields_are_removed(self):
		food = self.set_value(self.old_field("food", "barcode"), "4006381333931")
		book = self.set_value(self.old_field("books", "isbn"), "978-0-306-40615-7")
		medicine = self.set_value(self.old_field("medicine", "pzn_barcode"), "-08585997")
		number = self.set_value(CategoryField.objects.get(inventory=self.inventory, key="barcode"), 96385074)

		move_barcode_fields(apps, None)

		self.assertEqual(
			{(barcode.entry_id, barcode.kind, barcode.value) for barcode in Barcode.objects.all()},
			{
				(food.pk, "ean", "4006381333931"),
				(book.pk, "isbn", "9780306406157"),
				(medicine.pk, "pzn", "08585997"),
				(number.pk, "ean", "96385074"),
			},
		)
		self.assertFalse(CategoryField.objects.filter(key__in=("barcode", "isbn", "pzn_barcode")).exists())

	def test_invalid_values_move_as_other_and_empty_ones_are_skipped(self):
		field = self.old_field("food", "barcode")
		invalid = self.set_value(field, "12345")
		self.set_value(field, "")
		self.set_value(field, None)

		move_barcode_fields(apps, None)

		self.assertEqual(list(Barcode.objects.values_list("entry_id", "kind", "value")), [(invalid.pk, "other", "12345")])

	def test_a_valid_value_of_another_type_keeps_that_type(self):
		entry = self.set_value(self.old_field("food", "barcode"), "9780306406157")

		move_barcode_fields(apps, None)

		self.assertEqual(list(Barcode.objects.values_list("entry_id", "kind")), [(entry.pk, "ean")])

	def test_other_fields_stay(self):
		custom = CategoryField.objects.create(inventory=self.inventory, key="barcode", label="Barcode", field_type="barcode")
		serial = CategoryField.objects.get(inventory=self.inventory, key="serial_number")

		move_barcode_fields(apps, None)

		self.assertTrue(CategoryField.objects.filter(pk__in=(custom.pk, serial.pk)).count() == 2)

	def test_default_categories_no_longer_add_the_fields(self):
		ensure_default_categories(self.inventory)

		self.assertFalse(CategoryField.objects.filter(inventory=self.inventory, key__in=("barcode", "isbn", "pzn_barcode")).exists())
