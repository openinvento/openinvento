import base64
import tempfile

from django.test.client import MULTIPART_CONTENT, encode_multipart
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from rest_framework.test import APIClient

from account_auth.models import CustomUser

from .models import Article, ArticleAttachment, ArticleCategory, Area, CategoryField, Chest, Inventory, Shelf


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
			"/api/articles/",
			{
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
			f"/api/articles/{article.uuid}/",
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
		self.chest = Chest.objects.create(name="Primary chest", area=self.area, shelf=self.shelf, inventory=self.inventory)
		self.other_chest = Chest.objects.create(name="Other chest", area=self.other_area, shelf=self.other_shelf, inventory=self.other_inventory)
		self.category = ArticleCategory.objects.create(name="Primary category", inventory=self.inventory)
		self.other_category = ArticleCategory.objects.create(name="Other category", inventory=self.other_inventory)
		self.article = Article.objects.create(
			name="Primary article",
			inventory=self.inventory,
			area=self.area,
			shelf=self.shelf,
			chest=self.chest,
			category=self.category,
		)

	def authenticate(self, user=None):
		self.client.force_authenticate(user=user or self.user)

	def test_non_member_cannot_read_or_update_inventory_objects(self):
		self.authenticate(self.other_user)

		self.assertEqual(self.client.get(f"/api/articles/{self.article.uuid}/").status_code, 404)
		self.assertEqual(
			self.client.patch(f"/api/articles/{self.article.uuid}/", {"name": "Stolen update"}, format="json").status_code,
			404,
		)

	def test_article_create_rejects_cross_inventory_relations(self):
		self.authenticate()
		response = self.client.post(
			"/api/articles/",
			{
				"name": "Invalid article",
				"inventory": str(self.inventory.uuid),
				"area": str(self.other_area.uuid),
				"shelf": str(self.other_shelf.uuid),
				"chest": str(self.other_chest.uuid),
				"category": str(self.other_category.uuid),
			},
			format="json",
		)

		self.assertEqual(response.status_code, 400)
		self.assertIn("area", response.json())

	def test_article_patch_rejects_cross_inventory_relations_and_inventory_switch(self):
		self.authenticate()

		response = self.client.patch(
			f"/api/articles/{self.article.uuid}/",
			{"area": str(self.other_area.uuid)},
			format="json",
		)
		self.assertEqual(response.status_code, 400)

		response = self.client.patch(
			f"/api/articles/{self.article.uuid}/",
			{"inventory": str(self.other_inventory.uuid)},
			format="json",
		)
		self.assertEqual(response.status_code, 400)
		self.article.refresh_from_db()
		self.assertEqual(self.article.inventory_id, self.inventory.uuid)

	def test_article_put_rejects_cross_inventory_relations(self):
		self.authenticate()
		response = self.client.put(
			f"/api/articles/{self.article.uuid}/",
			{
				"name": "Invalid replacement",
				"inventory": str(self.inventory.uuid),
				"area": str(self.other_area.uuid),
				"quantity": 1,
			},
			format="json",
		)

		self.assertEqual(response.status_code, 400)

	def test_category_field_rejects_cross_inventory_category(self):
		self.authenticate()
		response = self.client.post(
			"/api/category-fields/",
			{
				"inventory": str(self.inventory.uuid),
				"category": str(self.other_category.uuid),
				"label": "Invalid field",
				"field_type": "text",
			},
			format="json",
		)

		self.assertEqual(response.status_code, 400)

	def test_hierarchy_and_self_reference_are_validated(self):
		self.authenticate()

		response = self.client.patch(
			f"/api/chests/{self.chest.uuid}/",
			{"parent_chest": str(self.chest.uuid)},
			format="json",
		)
		self.assertEqual(response.status_code, 400)

		response = self.client.patch(
			f"/api/articles/{self.article.uuid}/",
			{"shelf": str(self.other_shelf.uuid)},
			format="json",
		)
		self.assertEqual(response.status_code, 400)

	def test_attachment_download_is_inventory_scoped(self):
		attachment = ArticleAttachment.objects.create(
			article=self.article,
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
			f"/api/articles/{self.article.uuid}/",
			HTTP_ORIGIN="https://attacker.example",
		)
		self.assertEqual(response.status_code, 200)
		self.assertIsNone(response.json()["image"])

