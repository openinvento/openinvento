import base64
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.test.client import MULTIPART_CONTENT, encode_multipart
from rest_framework.test import APIClient
from django.utils import timezone

from account_auth.models import CustomUser, Notification
from inventory.jobs.date_field_sync import sync_date_field_notifications

from .models import ArticleAttachment, ArticleCategory, ArticleFieldValue, CategoryField, Inventory, InventoryEntry


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
