import base64
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings

from account_auth.models import CustomUser

from .models import Article, Inventory


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

