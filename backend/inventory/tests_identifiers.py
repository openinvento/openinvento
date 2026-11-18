from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from account_auth.models import CustomUser

from .models import Inventory, InventoryEntry


def identifiers():
	return {
		"inventories": set(Inventory.objects.values_list("identifier", flat=True)),
		"entries": set(InventoryEntry.objects.values_list("identifier", flat=True)),
	}


class UppercaseIdentifiersCommandTests(TestCase):
	def setUp(self):
		self.inventory = Inventory.objects.create(name="Home", identifier="UrB29")
		self.area = InventoryEntry.objects.create(inventory=self.inventory, type="area", name="Kitchen", identifier="yhKXKrpTfW")

	def run_command(self, *args):
		output = StringIO()
		call_command("uppercase_identifiers", *args, stdout=output)
		return output.getvalue()

	def test_without_apply_it_only_lists_the_changes(self):
		output = self.run_command()

		self.assertIn("inventory: UrB29 -> URB29", output)
		self.assertIn("entry in Home: yhKXKrpTfW -> YHKXKRPTFW", output)
		self.assertIn("2 identifiers would change", output)
		self.assertEqual(identifiers(), {"inventories": {"UrB29"}, "entries": {"yhKXKrpTfW"}})

	def test_apply_writes_them_in_uppercase(self):
		self.assertIn("Changed 2 identifiers", self.run_command("--apply"))

		self.assertEqual(identifiers(), {"inventories": {"URB29"}, "entries": {"YHKXKRPTFW"}})

	def test_uppercase_hand_picked_and_empty_identifiers_stay(self):
		self.area.delete()
		for identifier in ("7GQ2MX4", "box-1", "a b"):
			InventoryEntry.objects.create(inventory=self.inventory, type="area", name=identifier, identifier=identifier)

		self.run_command("--apply")

		self.assertEqual(identifiers()["entries"], {"7GQ2MX4", "box-1", "a b"})

	def test_identifiers_that_differ_only_in_case_all_stay(self):
		# Changing one of them would point a label printed with the other old value at the wrong entry.
		for twin in ("YHKXKRPTFW", "YhKXKrpTfW"):
			with self.subTest(twin=twin):
				twin_entry = InventoryEntry.objects.create(inventory=self.inventory, type="area", name="Twin", identifier=twin)

				output = self.run_command("--apply")

				self.assertIn("entry in Home: yhKXKrpTfW stays, another identifier differs from it only in case", output)
				self.assertEqual(identifiers()["entries"], {"yhKXKrpTfW", twin})
				twin_entry.delete()

	def test_same_identifier_in_two_inventories_is_no_clash(self):
		other = Inventory.objects.create(name="Office", identifier="OFFCE")
		InventoryEntry.objects.create(inventory=other, type="area", name="Desk", identifier="yhKXKrpTfW")

		self.run_command("--apply")

		self.assertEqual(identifiers()["entries"], {"YHKXKRPTFW"})


class CaseInsensitiveLookupTests(TestCase):
	def setUp(self):
		self.user = CustomUser.objects.create_user(username="scanner", password="StrongPassword!123")
		self.inventory = Inventory.objects.create(name="Home", identifier="URB29")
		self.inventory.users.add(self.user)
		self.entry = InventoryEntry.objects.create(inventory=self.inventory, type="area", name="Kitchen", identifier="YHKXKRPTFW")
		self.client = APIClient()
		self.client.force_login(self.user)

	def lookup(self, **data):
		return self.client.post("/api/codes/lookup/", data, format="json")

	def test_label_printed_before_uppercasing_still_opens_the_entry(self):
		scan_url = self.lookup(identifier="yhKXKrpTfW", inventory_identifier="UrB29")
		bare = self.lookup(identifier="yhKXKrpTfW")

		for response in (scan_url, bare):
			with self.subTest(response=response):
				self.assertEqual(response.status_code, 200)
				self.assertEqual(response.data["matches"][0]["uuid"], str(self.entry.uuid))

	def test_exact_match_wins(self):
		lower = InventoryEntry.objects.create(inventory=self.inventory, type="area", name="Lower", identifier="yhkxkrptfw")

		response = self.lookup(identifier="yhkxkrptfw", inventory_identifier="URB29")

		self.assertEqual(response.data["matches"][0]["uuid"], str(lower.uuid))

	def test_exact_match_in_another_inventory_beats_a_case_insensitive_one_in_the_given_one(self):
		other = Inventory.objects.create(name="Office", identifier="OFFCE")
		other.users.add(self.user)
		exact = InventoryEntry.objects.create(inventory=other, type="area", name="Exact", identifier="A-1")
		InventoryEntry.objects.create(inventory=self.inventory, type="area", name="Loose", identifier="a-1")

		response = self.lookup(identifier="A-1", inventory=str(self.inventory.uuid))

		self.assertEqual(response.data["matches"][0]["uuid"], str(exact.uuid))

	def test_ambiguous_case_insensitive_match_is_not_guessed(self):
		InventoryEntry.objects.create(inventory=self.inventory, type="area", name="Lower", identifier="yhkxkrptfw")

		self.assertEqual(self.lookup(identifier="YhKxKrPtFw", inventory_identifier="URB29").status_code, 404)
		self.assertEqual(self.lookup(identifier="YhKxKrPtFw").status_code, 404)

	def test_foreign_inventory_stays_hidden(self):
		foreign = Inventory.objects.create(name="Foreign", identifier="FORGN")
		InventoryEntry.objects.create(inventory=foreign, type="area", name="Theirs", identifier="SECRET1")

		self.assertEqual(self.lookup(identifier="secret1", inventory_identifier="forgn").status_code, 404)
		self.assertEqual(self.lookup(identifier="secret1").status_code, 404)
