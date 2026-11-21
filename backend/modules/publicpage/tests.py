import base64
import tempfile

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from account_auth.models import CustomUser, InstanceSettings, Notification
from inventory.models import Inventory, InventoryEntry

from .models import PublicPage

ONE_PIXEL_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
)


class PublicPageTestCase(TestCase):
    def setUp(self):
        cache.clear()  # throttle counters
        media_directory = tempfile.TemporaryDirectory()
        self.addCleanup(media_directory.cleanup)
        media_settings = override_settings(MEDIA_ROOT=media_directory.name)
        media_settings.enable()
        self.addCleanup(media_settings.disable)

        settings = InstanceSettings.get_solo()
        settings.enabled_modules = ["publicpage"]
        settings.save()

        self.client = APIClient()
        self.owner = CustomUser.objects.create_user(username="owner", email="owner@example.com", password="password")
        self.member = CustomUser.objects.create_user(username="member", email="member@example.com", password="password")
        self.stranger = CustomUser.objects.create_user(username="stranger", password="password")
        self.inventory = Inventory.objects.create(name="Home", identifier="HOME1")
        self.inventory.users.add(self.owner, self.member)
        self.backpack = InventoryEntry.objects.create(
            name="Blue backpack",
            type="article",
            identifier="BAG1",
            inventory=self.inventory,
            image=SimpleUploadedFile("bag.png", ONE_PIXEL_PNG, content_type="image/png"),
        )
        self.drill = InventoryEntry.objects.create(name="Drill", type="article", identifier="DRILL", inventory=self.inventory)

    def public_url(self, identifier="BAG1", inventory="HOME1", suffix=""):
        return f"/api/publicpage/scan/{inventory}/{identifier}/{suffix}"


class PublicPageViewTests(PublicPageTestCase):
    def setUp(self):
        super().setUp()
        PublicPage.objects.create(entry=self.backpack, show_photo=True, note="Reward: 20 EUR")

    def test_shows_only_enabled_fields(self):
        response = self.client.get(self.public_url())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"name": "Blue backpack", "has_photo": True, "note": "Reward: 20 EUR"})

    def test_hides_name_and_photo_unless_enabled(self):
        PublicPage.objects.filter(entry=self.backpack).update(show_name=False, show_photo=False)

        response = self.client.get(self.public_url())

        self.assertEqual(response.json(), {"name": None, "has_photo": False, "note": "Reward: 20 EUR"})
        self.assertEqual(self.client.get(self.public_url(suffix="photo/")).status_code, 404)

    def test_serves_the_photo_only_when_enabled(self):
        response = self.client.get(self.public_url(suffix="photo/"))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(b"".join(response.streaming_content), ONE_PIXEL_PNG)

    def test_unknown_and_not_opted_in_entries_get_the_same_404(self):
        foreign = Inventory.objects.create(name="Foreign", identifier="OTHER")
        InventoryEntry.objects.create(name="Bag", type="article", identifier="BAG1", inventory=foreign)

        for url in (
            self.public_url("DRILL"),
            self.public_url("MISSING"),
            self.public_url(inventory="OTHER"),
            self.public_url(inventory="NOPE"),
        ):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, 404)
                self.assertEqual(response.json(), {"detail": "Not found."})

    def test_matches_case_insensitively_like_the_code_lookup(self):
        self.assertEqual(self.client.get(self.public_url("bag1", "home1")).status_code, 200)

    def test_works_for_signed_in_users_of_other_inventories(self):
        self.client.force_login(self.stranger)

        self.assertEqual(self.client.get(self.public_url()).status_code, 200)

    def test_is_hidden_while_the_module_is_disabled(self):
        settings = InstanceSettings.get_solo()
        settings.enabled_modules = []
        settings.save()

        self.assertEqual(self.client.get(self.public_url()).status_code, 404)
        self.assertEqual(self.client.get(self.public_url(suffix="photo/")).status_code, 404)
        self.assertEqual(self.client.post(self.public_url(suffix="contact/"), {"message": "Hi"}).status_code, 404)

    def test_contact_notifies_all_members_without_exposing_them(self):
        response = self.client.post(
            self.public_url(suffix="contact/"),
            {"message": "Found it at the station.", "contact": "+49 123"},
            format="json",
        )

        self.assertEqual(response.status_code, 204)
        self.assertEqual(response.content, b"")
        notifications = Notification.objects.filter(kind="publicpage")
        self.assertEqual({n.user for n in notifications}, {self.owner, self.member})
        notification = notifications.first()
        self.assertEqual(notification.title, "New message about Blue backpack")
        self.assertEqual(notification.message, "Found it at the station.\n\nContact: +49 123")
        self.assertEqual(notification.link, "/i/HOME1/BAG1")

    def test_contact_requires_a_message(self):
        response = self.client.post(self.public_url(suffix="contact/"), {"contact": "me"}, format="json")

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Notification.objects.exists())

    def test_contact_is_rate_limited(self):
        for _ in range(5):
            self.client.post(self.public_url(suffix="contact/"), {"message": "Hi"}, format="json")

        response = self.client.post(self.public_url(suffix="contact/"), {"message": "Hi"}, format="json")

        self.assertEqual(response.status_code, 429)
        self.assertEqual(Notification.objects.filter(user=self.owner).count(), 5)

    def test_contact_for_entries_without_opt_in_is_a_404(self):
        response = self.client.post(self.public_url("DRILL", suffix="contact/"), {"message": "Hi"}, format="json")

        self.assertEqual(response.status_code, 404)
        self.assertFalse(Notification.objects.exists())


class OwnerSettingsTests(PublicPageTestCase):
    def url(self, entry):
        return f"/api/publicpage/entries/{entry.uuid}/"

    def test_put_turns_the_page_on_and_updates_it(self):
        self.client.force_authenticate(self.owner)

        response = self.client.put(self.url(self.drill), {"show_name": True, "show_photo": False, "note": "Call me"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        response = self.client.put(self.url(self.drill), {"show_name": False, "note": "Reward"}, format="json")

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data, {"show_name": False, "show_photo": False, "note": "Reward"})
        self.assertEqual(self.client.get(self.url(self.drill)).data["note"], "Reward")

    def test_delete_turns_the_page_off(self):
        PublicPage.objects.create(entry=self.drill)
        self.client.force_authenticate(self.member)

        self.assertEqual(self.client.delete(self.url(self.drill)).status_code, 204)
        self.assertFalse(PublicPage.objects.exists())
        self.assertEqual(self.client.get(self.url(self.drill)).status_code, 404)

    def test_works_for_any_entry_type(self):
        area = InventoryEntry.objects.create(name="Garage", type="area", inventory=self.inventory)
        self.client.force_authenticate(self.owner)

        self.assertEqual(self.client.put(self.url(area), {}, format="json").status_code, 200)

    def test_non_members_cannot_read_or_change_it(self):
        PublicPage.objects.create(entry=self.drill, note="Secret")
        self.client.force_authenticate(self.stranger)

        self.assertEqual(self.client.get(self.url(self.drill)).status_code, 404)
        self.assertEqual(self.client.put(self.url(self.backpack), {}, format="json").status_code, 404)
        self.assertEqual(self.client.delete(self.url(self.drill)).status_code, 404)
        self.assertTrue(PublicPage.objects.filter(entry=self.drill).exists())

    def test_requires_login(self):
        self.assertEqual(self.client.get(self.url(self.drill)).status_code, 403)
