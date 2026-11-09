import base64
import tempfile
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.test.client import MULTIPART_CONTENT, encode_multipart
from rest_framework.test import APIClient
from django.utils import timezone

from account_auth.models import CustomUser, Notification, UserAPIKey
from inventory.jobs.date_field_sync import sync_date_field_notifications

from .models import CODE_CHARACTERS, ArticleAttachment, ArticleCategory, ArticleFieldValue, CategoryField, Inventory, InventoryEntry


class TypedEntryFacade:
	def __init__(self, key):
		self.key = key

	def create(self, **kwargs):
		parent = kwargs.pop("parent", None)
		area = kwargs.pop("area", None)
		shelf = kwargs.pop("shelf", None)
		box = kwargs.pop("box", None)
		parent_box = kwargs.pop("parent_box", None)
		if self.key == "shelf": parent = parent or area
		if self.key == "box": parent = parent or parent_box or shelf or area
		if self.key == "article": parent = parent or box or shelf or area
		return InventoryEntry.objects.create(type=self.key, parent=parent, **kwargs)

	def get(self, **kwargs):
		return InventoryEntry.objects.get(type=self.key, **kwargs)


Article = type("Article", (), {"objects": TypedEntryFacade("article")})
Area = type("Area", (), {"objects": TypedEntryFacade("area")})
Shelf = type("Shelf", (), {"objects": TypedEntryFacade("shelf")})
Box = type("Box", (), {"objects": TypedEntryFacade("box")})


ONE_PIXEL_PNG = base64.b64decode(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


class ArticleImageTests(TestCase):
	def setUp(self):
		self.media_directory = tempfile.TemporaryDirectory()
		self.media_settings = override_settings(MEDIA_ROOT=self.media_directory.name)
		self.media_settings.enable()
		self.client = Client()
		self.user = CustomUser.objects.create_user(
			username="owner", email="owner@example.com", password="password"
		)
		self.other_user = CustomUser.objects.create_user(
			username="other", email="other@example.com", password="password"
		)
		self.inventory = Inventory.objects.create(name="Private inventory")
		self.inventory.users.add(self.user)

	def tearDown(self):
		self.media_settings.disable()
		self.media_directory.cleanup()

	def test_article_image_upload_and_access_are_inventory_scoped(self):
		self.client.force_login(self.user)
		response = self.client.post(
			"/api/entries/",
			{
				"type": "article",
				"name": "Uploaded article",
				"inventory": str(self.inventory.uuid),
				"image": SimpleUploadedFile("../unsafe.png", ONE_PIXEL_PNG, content_type="image/png"),
			},
		)

		self.assertEqual(response.status_code, 201)
		article = Article.objects.get(name="Uploaded article")
		self.assertTrue(article.image.name.startswith("articles/"))
		self.assertNotIn("unsafe", article.image.name)

		media_response = self.client.get(f"/media/{article.image.name}")
		self.assertEqual(media_response.status_code, 200)
		self.assertEqual(media_response["Content-Disposition"], f'inline; filename="{article.image.name.rsplit("/", 1)[-1]}"')
		media_response.close()

		self.client.force_login(self.other_user)
		self.assertEqual(self.client.get(f"/media/{article.image.name}").status_code, 404)

	def test_media_requires_login_and_rejects_path_traversal(self):
		article = Article.objects.create(
			name="Stored article",
			inventory=self.inventory,
			image=SimpleUploadedFile("stored.png", ONE_PIXEL_PNG, content_type="image/png"),
		)

		self.assertEqual(self.client.get(f"/media/{article.image.name}").status_code, 403)

		self.client.force_login(self.user)
		self.assertEqual(self.client.get("/media/../db.sqlite3").status_code, 404)

	def test_article_image_can_be_updated(self):
		self.client.force_login(self.user)
		article = Article.objects.create(name="Editable article", inventory=self.inventory)

		response = self.client.patch(
			f"/api/entries/{article.uuid}/",
			encode_multipart(
				"BoUnDaRyStRiNg",
				{"image": SimpleUploadedFile("updated.png", ONE_PIXEL_PNG, content_type="image/png")},
			),
			content_type=MULTIPART_CONTENT,
		)

		self.assertEqual(response.status_code, 200)
		article.refresh_from_db()
		self.assertTrue(article.image.name.startswith("articles/"))
		self.assertEqual(response.json()["image"], f"/media/{article.image.name}")


class InventoryIsolationTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.user = CustomUser.objects.create_user(username="member", password="password")
		self.other_user = CustomUser.objects.create_user(username="outsider", password="password")
		self.inventory = Inventory.objects.create(name="Primary inventory")
		self.other_inventory = Inventory.objects.create(name="Other inventory")
		self.inventory.users.add(self.user)
		self.other_inventory.users.add(self.user)
		self.area = Area.objects.create(name="Primary area", inventory=self.inventory)
		self.other_area = Area.objects.create(name="Other area", inventory=self.other_inventory)
		self.shelf = Shelf.objects.create(name="Primary shelf", area=self.area, inventory=self.inventory)
		self.other_shelf = Shelf.objects.create(name="Other shelf", area=self.other_area, inventory=self.other_inventory)
		self.box = Box.objects.create(name="Primary box", area=self.area, shelf=self.shelf, inventory=self.inventory)
		self.other_box = Box.objects.create(name="Other box", area=self.other_area, shelf=self.other_shelf, inventory=self.other_inventory)
		self.category = ArticleCategory.objects.create(name="Primary category", inventory=self.inventory)
		self.other_category = ArticleCategory.objects.create(name="Other category", inventory=self.other_inventory)
		self.article = Article.objects.create(
			name="Primary article",
			inventory=self.inventory,
			area=self.area,
			shelf=self.shelf,
			box=self.box,
			category=self.category,
		)

	def authenticate(self, user=None):
		self.client.force_authenticate(user=user or self.user)

	def test_non_member_cannot_read_or_update_inventory_objects(self):
		self.authenticate(self.other_user)

		self.assertEqual(self.client.get(f"/api/entries/{self.article.uuid}/").status_code, 404)
		self.assertEqual(
			self.client.patch(f"/api/entries/{self.article.uuid}/", {"name": "Stolen update"}, format="json").status_code,
			404,
		)

	def test_article_create_rejects_cross_inventory_relations(self):
		self.authenticate()
		response = self.client.post(
			"/api/entries/",
			{
				"type": "article",
				"name": "Invalid article",
				"inventory": str(self.inventory.uuid),
				"parent": str(self.other_box.uuid),
				"category": str(self.other_category.uuid),
			},
			format="json",
		)

		self.assertEqual(response.status_code, 400)
		self.assertIn("parent", response.json())

	def test_article_patch_rejects_cross_inventory_relations_and_inventory_switch(self):
		self.authenticate()

		response = self.client.patch(
			f"/api/entries/{self.article.uuid}/",
			{
				"parent": str(self.other_shelf.uuid),
			},
			format="json",
		)
		self.assertEqual(response.status_code, 400)

		response = self.client.patch(
			f"/api/entries/{self.article.uuid}/",
			{"inventory": str(self.other_inventory.uuid)},
			format="json",
		)
		self.assertEqual(response.status_code, 400)

	def test_article_create_and_patch_accept_valid_scoped_relations(self):
		self.authenticate()

		created_response = self.client.post(
			"/api/entries/",
			{
				"type": "article",
				"name": "Valid article",
				"inventory": str(self.inventory.uuid),
				"parent": str(self.box.uuid),
				"category": str(self.category.uuid),
			},
			format="json",
		)
		self.assertEqual(created_response.status_code, 201)

		article_uuid = created_response.json()["uuid"]
		patch_response = self.client.patch(
			f"/api/entries/{article_uuid}/",
			{
				"name": "Updated valid article",
				"parent": str(self.area.uuid),
			},
			format="json",
		)
		self.assertEqual(patch_response.status_code, 200)

	def test_deleting_box_reparents_contents_to_its_parent(self):
		self.authenticate()
		nested_box = Box.objects.create(name="Nested box", inventory=self.inventory, parent=self.box)
		article = Article.objects.create(name="Box article", inventory=self.inventory, parent=self.box)

		response = self.client.delete(f"/api/entries/{self.box.uuid}/")

		self.assertEqual(response.status_code, 204)
		nested_box.refresh_from_db()
		article.refresh_from_db()
		self.assertEqual(nested_box.parent_id, self.shelf.uuid)
		self.assertEqual(article.parent_id, self.shelf.uuid)

	def test_deleting_box_with_contents_removes_the_subtree(self):
		self.authenticate()
		nested_box = Box.objects.create(name="Nested box", inventory=self.inventory, parent=self.box)
		article = Article.objects.create(name="Box article", inventory=self.inventory, parent=nested_box)

		response = self.client.delete(
			f"/api/entries/{self.box.uuid}/?delete_contents=true",
		)

		self.assertEqual(response.status_code, 204)
		self.assertFalse(InventoryEntry.objects.filter(pk=self.box.uuid).exists())
		self.assertFalse(InventoryEntry.objects.filter(pk=nested_box.uuid).exists())
		self.assertFalse(InventoryEntry.objects.filter(pk=article.uuid).exists())

	def test_category_field_rejects_foreign_category(self):
		self.authenticate()

		response = self.client.post(
			"/api/category-fields/",
			{
				"inventory": str(self.inventory.uuid),
				"label": "Invalid field",
				"category": str(self.other_category.uuid),
			},
			format="json",
		)

		self.assertEqual(response.status_code, 400)

	def test_hierarchy_and_self_reference_are_validated(self):
		self.authenticate()

		response = self.client.patch(
			f"/api/entries/{self.box.uuid}/",
			{"parent": str(self.box.uuid)},
			format="json",
		)
		self.assertEqual(response.status_code, 400)

		response = self.client.patch(
			f"/api/entries/{self.article.uuid}/",
			{"parent": str(self.other_shelf.uuid)},
			format="json",
		)
		self.assertEqual(response.status_code, 400)

	def test_attachment_download_is_inventory_scoped(self):
		attachment = ArticleAttachment.objects.create(
			entry=self.article,
			original_name="private.txt",
			file=SimpleUploadedFile("private.txt", b"private"),
		)

		self.authenticate(self.other_user)
		self.assertEqual(self.client.get(f"/media/{attachment.file.name}").status_code, 404)

		self.authenticate()
		response = self.client.get(f"/media/{attachment.file.name}")
		self.assertEqual(response.status_code, 200)
		response.close()

	def test_media_urls_ignore_untrusted_origin(self):
		self.authenticate()
		response = self.client.get(
			f"/api/entries/{self.article.uuid}/",
			HTTP_ORIGIN="https://attacker.example",
		)
		self.assertEqual(response.status_code, 200)
		self.assertIsNone(response.json()["image"])


class DateFieldNotificationTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.user = CustomUser.objects.create_user(username="date-owner", password="password")
		self.inventory = Inventory.objects.create(name="Reminder inventory")
		self.inventory.users.add(self.user)
		self.area = Area.objects.create(name="Reminder area", inventory=self.inventory)
		self.field = CategoryField.objects.create(
			label="Expiry date", key="expiry-date", field_type="date", inventory=self.inventory,
		)
		self.client.force_authenticate(user=self.user)

	def test_article_api_saves_date_notification_preference(self):
		response = self.client.post(
			"/api/entries/",
			{
				"type": "article",
				"name": "Milk",
				"inventory": str(self.inventory.uuid),
				"parent": str(self.area.uuid),
				"field_values_input": [{
					"field": str(self.field.uuid),
					"key": self.field.key,
					"value": timezone.localdate().isoformat(),
					"notify_on_date": True,
				}],
			},
			format="json",
		)

		self.assertEqual(response.status_code, 201, response.json())
		value = ArticleFieldValue.objects.get(entry__uuid=response.json()["uuid"], field=self.field)
		self.assertEqual(value.value, timezone.localdate().isoformat())
		self.assertTrue(value.notify_on_date)

	def test_sync_creates_idempotent_reminder_for_due_date(self):
		article = Article.objects.create(name="Milk", inventory=self.inventory, area=self.area)
		ArticleFieldValue.objects.create(
			entry=article,
			field=self.field,
			value=timezone.localdate().isoformat(),
			notify_on_date=True,
		)

		sync_date_field_notifications(self.user)
		sync_date_field_notifications(self.user)

		notifications = Notification.objects.filter(user=self.user, kind="date_reminder")
		self.assertEqual(notifications.count(), 1)
		reminder = notifications.get()
		self.assertEqual(reminder.title, "Date reminder: Expiry date")
		self.assertEqual(reminder.link, f"/app/articles/{article.uuid}")
		self.assertEqual(reminder.metadata["date"], timezone.localdate().isoformat())

	def test_sync_ignores_disabled_and_non_due_dates(self):
		for name, value, enabled in (
			("Disabled", timezone.localdate().isoformat(), False),
			("Future", "2999-01-01", True),
		):
			article = Article.objects.create(name=name, inventory=self.inventory, area=self.area)
			ArticleFieldValue.objects.create(entry=article, field=self.field, value=value, notify_on_date=enabled)

		sync_date_field_notifications(self.user)

		self.assertFalse(Notification.objects.filter(user=self.user, kind="date_reminder").exists())


class GeneratedIdentifierTests(TestCase):
	def test_new_inventory_gets_a_short_identifier_without_ambiguous_characters(self):
		identifier = Inventory.objects.create(name="Home").identifier

		self.assertEqual(len(identifier), 5)
		self.assertTrue(set(identifier) <= set(CODE_CHARACTERS))

	def test_new_entry_gets_a_short_identifier_from_the_same_alphabet(self):
		inventory = Inventory.objects.create(name="Home")

		identifier = InventoryEntry.objects.create(name="Attic", type="area", inventory=inventory).identifier

		self.assertEqual(len(identifier), 7)
		self.assertTrue(set(identifier) <= set(CODE_CHARACTERS))

	def test_new_category_keeps_ten_characters_from_the_same_alphabet(self):
		inventory = Inventory.objects.create(name="Home")

		identifier = ArticleCategory.objects.create(name="Tools", inventory=inventory).identifier

		self.assertEqual(len(identifier), 10)
		self.assertTrue(set(identifier) <= set(CODE_CHARACTERS))

	def test_alphabet_is_crockford_base32(self):
		self.assertEqual(CODE_CHARACTERS, "0123456789ABCDEFGHJKMNPQRSTVWXYZ")
		self.assertFalse(set("ILOU") & set(CODE_CHARACTERS))

	def test_entry_picks_another_identifier_on_a_collision(self):
		inventory = Inventory.objects.create(name="Home")
		InventoryEntry.objects.create(name="First", type="area", inventory=inventory, identifier="ABCDEFG")

		with patch("inventory.models.generate_random_code", side_effect=["ABCDEFG", "HJKMNPQ"]):
			entry = InventoryEntry.objects.create(name="Second", type="area", inventory=inventory)

		self.assertEqual(entry.identifier, "HJKMNPQ")

	def test_entry_can_use_an_identifier_taken_in_another_inventory(self):
		other = Inventory.objects.create(name="Other")
		InventoryEntry.objects.create(name="First", type="area", inventory=other, identifier="ABCDEFG")
		inventory = Inventory.objects.create(name="Home")

		with patch("inventory.models.generate_random_code", return_value="ABCDEFG"):
			entry = InventoryEntry.objects.create(name="Second", type="area", inventory=inventory)

		self.assertEqual(entry.identifier, "ABCDEFG")

	def test_existing_identifier_stays_when_the_entry_is_saved(self):
		inventory = Inventory.objects.create(name="Home")
		entry = InventoryEntry.objects.create(name="Old", type="area", inventory=inventory, identifier="X7k9P2mQ1a")
		entry.name = "Renamed"
		entry.save()

		entry.refresh_from_db()
		self.assertEqual(entry.identifier, "X7k9P2mQ1a")

	def test_inventory_picks_another_identifier_on_a_collision(self):
		Inventory.objects.create(name="First", identifier="abcde")

		# Without the default categories, which draw codes as well.
		with (
			patch("inventory.category_defaults.ensure_default_categories"),
			patch("inventory.models.generate_random_code", side_effect=["abcde", "FGHJK"]),
		):
			inventory = Inventory.objects.create(name="Second")

		self.assertEqual(inventory.identifier, "FGHJK")

	def test_existing_identifier_stays_when_the_inventory_is_saved(self):
		inventory = Inventory.objects.create(name="Old", identifier="X7k9P2mQ1a")
		inventory.name = "Renamed"
		inventory.save()

		inventory.refresh_from_db()
		self.assertEqual(inventory.identifier, "X7k9P2mQ1a")


class EntriesWithoutParentTests(TestCase):
	def setUp(self):
		self.user = CustomUser.objects.create_user(username="owner", password="StrongPassword!123")
		self.inventory = Inventory.objects.create(name="Apartment")
		self.inventory.users.add(self.user)
		self.other = Inventory.objects.create(name="Other")
		self.area = InventoryEntry.objects.create(inventory=self.inventory, type="area", name="Study")
		self.category = ArticleCategory.objects.create(inventory=self.inventory, name="Tools")
		self.article = InventoryEntry.objects.create(
			inventory=self.inventory, type="article", name="Laptop", parent=self.area, category=self.category,
		)
		self.client = APIClient()
		self.client.force_login(self.user)

	def patch_form(self, **data):
		return self.client.patch(f"/api/entries/{self.article.uuid}/", data, format="multipart")

	def test_article_can_be_created_without_a_parent(self):
		response = self.client.post(
			"/api/entries/",
			{"type": "article", "name": "Backpack", "inventory": str(self.inventory.uuid), "parent": ""},
			format="multipart",
		)

		self.assertEqual(response.status_code, 201)
		self.assertIsNone(response.data["parent"])

	def test_empty_parent_removes_the_article_from_its_area(self):
		response = self.patch_form(parent="", type="article")

		self.assertEqual(response.status_code, 200)
		self.article.refresh_from_db()
		self.assertIsNone(self.article.parent)

	def test_missing_parent_keeps_the_area(self):
		response = self.patch_form(name="Renamed", type="article")

		self.assertEqual(response.status_code, 200)
		self.article.refresh_from_db()
		self.assertEqual(self.article.parent, self.area)

	def test_empty_category_removes_the_category(self):
		response = self.patch_form(category="", type="article")

		self.assertEqual(response.status_code, 200)
		self.article.refresh_from_db()
		self.assertIsNone(self.article.category)

	def test_box_still_needs_a_parent(self):
		response = self.client.post(
			"/api/entries/",
			{"type": "box", "name": "Crate", "inventory": str(self.inventory.uuid), "parent": ""},
			format="multipart",
		)

		self.assertEqual(response.status_code, 400)

	def test_root_filter_lists_only_entries_without_a_parent(self):
		root = InventoryEntry.objects.create(inventory=self.inventory, type="article", name="Keys")
		InventoryEntry.objects.create(inventory=self.other, type="article", name="Foreign")

		response = self.client.get("/api/entries/", {"type": "article", "root": "true", "include_ancestors": "true"})

		self.assertEqual(response.status_code, 200)
		self.assertEqual([entry["uuid"] for entry in response.data], [str(root.uuid)])


class CodeLookupTests(TestCase):
	def setUp(self):
		self.user = CustomUser.objects.create_user(username="scanner", password="StrongPassword!123")
		self.home = self.user.inventories.first() or Inventory.objects.create(name="Home")
		self.home.users.add(self.user)
		self.office = Inventory.objects.create(name="Office")
		self.office.users.add(self.user)
		self.foreign = Inventory.objects.create(name="Foreign")
		self.home_entry = InventoryEntry.objects.create(inventory=self.home, type="area", name="Home area", identifier="SAME")
		self.office_entry = InventoryEntry.objects.create(inventory=self.office, type="area", name="Office area", identifier="SAME")
		self.foreign_entry = InventoryEntry.objects.create(inventory=self.foreign, type="area", name="Foreign area", identifier="FOREIGN")
		self.client = APIClient()
		self.client.force_login(self.user)

	def lookup(self, **data):
		return self.client.post("/api/codes/lookup/", data, format="json")

	def test_inventory_identifier_selects_the_inventory(self):
		for inventory, entry in ((self.home, self.home_entry), (self.office, self.office_entry)):
			with self.subTest(inventory=inventory.name):
				response = self.lookup(identifier="SAME", inventory_identifier=inventory.identifier)

				self.assertEqual(response.status_code, 200)
				self.assertEqual(response.data["uuid"], str(entry.uuid))
				self.assertEqual(response.data["inventory"]["uuid"], str(inventory.uuid))

	def test_inventory_identifier_does_not_fall_back_to_other_inventories(self):
		InventoryEntry.objects.create(inventory=self.home, type="area", name="Only at home", identifier="ONLY-HOME")

		response = self.lookup(identifier="ONLY-HOME", inventory_identifier=self.office.identifier)

		self.assertEqual(response.status_code, 404)

	def test_inventory_identifier_takes_precedence_over_inventory(self):
		response = self.lookup(identifier="SAME", inventory_identifier=self.office.identifier, inventory=str(self.home.uuid))

		self.assertEqual(response.data["uuid"], str(self.office_entry.uuid))

	def test_foreign_and_unknown_inventories_get_the_same_answer(self):
		foreign = self.lookup(identifier="FOREIGN", inventory_identifier=self.foreign.identifier)
		unknown = self.lookup(identifier="FOREIGN", inventory_identifier="nope")
		unknown_entry = self.lookup(identifier="nope", inventory_identifier=self.home.identifier)

		self.assertEqual(foreign.status_code, 404)
		self.assertEqual(foreign.data, unknown.data)
		self.assertEqual(foreign.data, unknown_entry.data)

	def test_identifier_with_a_slash_is_found(self):
		entry = InventoryEntry.objects.create(inventory=self.home, type="area", name="Slash", identifier="A/1")

		response = self.lookup(identifier="A/1", inventory_identifier=self.home.identifier)

		self.assertEqual(response.data["uuid"], str(entry.uuid))

	def test_bare_identifier_prefers_the_given_inventory_and_falls_back(self):
		preferred = self.lookup(identifier="SAME", inventory=str(self.office.uuid))
		self.assertEqual(preferred.data["uuid"], str(self.office_entry.uuid))

		InventoryEntry.objects.create(inventory=self.home, type="area", name="Only at home", identifier="ONLY-HOME")
		fallback = self.lookup(identifier="ONLY-HOME", inventory=str(self.office.uuid))
		self.assertEqual(fallback.data["inventory"]["uuid"], str(self.home.uuid))

	def test_bare_identifier_never_finds_foreign_entries(self):
		self.assertEqual(self.lookup(identifier="FOREIGN").status_code, 404)
		self.assertEqual(self.lookup(identifier="FOREIGN", inventory=str(self.foreign.uuid)).status_code, 404)

	def test_identifier_is_required(self):
		self.assertEqual(self.lookup(inventory_identifier=self.home.identifier).status_code, 400)

	def test_api_key_can_use_inventory_identifier(self):
		_, key = UserAPIKey.objects.create_key(name="scanner", user=self.user)
		client = APIClient()

		response = client.post(
			"/api/codes/lookup/",
			{"identifier": "SAME", "inventory_identifier": self.office.identifier},
			format="json",
			HTTP_AUTHORIZATION=f"Api-Key {key}",
		)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["uuid"], str(self.office_entry.uuid))

	def test_anonymous_requests_are_rejected(self):
		response = APIClient().post(
			"/api/codes/lookup/",
			{"identifier": "SAME", "inventory_identifier": self.home.identifier},
			format="json",
		)

		self.assertIn(response.status_code, (302, 401, 403))
		self.assertNotIn("uuid", getattr(response, "data", None) or {})
