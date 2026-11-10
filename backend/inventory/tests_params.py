import io

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image
from rest_framework.test import APIClient

from account_auth.models import CustomUser

from .models import Inventory, InventoryEntry


class MalformedInventoryUuidTests(TestCase):
	"""A malformed inventory UUID is a 400 for the client, not a 500 with a debug page."""

	def setUp(self):
		self.user = CustomUser.objects.create_user(username="owner", password="StrongPassword!123")
		self.inventory = Inventory.objects.create(name="Home")
		self.inventory.users.add(self.user)
		InventoryEntry.objects.create(inventory=self.inventory, type="area", name="Kitchen")
		self.client = APIClient()
		self.client.force_login(self.user)

	def test_list_endpoints_reject_it(self):
		for path in ("/api/entries/", "/api/article-categories/", "/api/third-party-providers/"):
			with self.subTest(path=path):
				response = self.client.get(path, {"inventory": "not-a-uuid"})

				self.assertEqual(response.status_code, 400)
				self.assertEqual(response.data, {"inventory": ["Must be a valid UUID."]})

	def test_search_rejects_it(self):
		response = self.client.get("/api/search/", {"q": "Kitchen", "inventory": "not-a-uuid"})

		self.assertEqual(response.status_code, 400)

	def test_magic_import_asks_for_an_accessible_inventory(self):
		buffer = io.BytesIO()
		Image.new("RGB", (8, 8)).save(buffer, format="PNG")
		image = SimpleUploadedFile("photo.png", buffer.getvalue(), content_type="image/png")

		response = self.client.post("/api/entries/magic-import/", {"image": image, "inventory": "not-a-uuid"}, format="multipart")

		self.assertEqual(response.status_code, 400)
		self.assertEqual(response.data, {"inventory": "Select an inventory you can access."})

	def test_valid_and_missing_uuids_still_filter(self):
		self.assertEqual(len(self.client.get("/api/entries/", {"inventory": str(self.inventory.uuid)}).data), 1)
		self.assertEqual(self.client.get("/api/entries/", {"inventory": "00000000-0000-0000-0000-000000000000"}).data, [])
		self.assertEqual(len(self.client.get("/api/entries/").data), 1)
