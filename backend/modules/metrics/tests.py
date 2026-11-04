import os
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from account_auth.models import CustomUser, InstanceSettings, UserAPIKey
from inventory.models import Inventory, InventoryEntry


class MetricsEndpointTests(TestCase):
    def setUp(self):
        settings = InstanceSettings.get_solo()
        settings.enabled_modules = ["metrics"]
        settings.save()

        self.client = APIClient()
        self.admin = CustomUser.objects.create_superuser(username="admin", password="StrongPassword!123")
        self.user = CustomUser.objects.create_user(username="member", password="StrongPassword!123")
        CustomUser.objects.create_user(username="former", password="StrongPassword!123", is_active=False)

        self.own_inventory = Inventory.objects.create(name="Workshop")
        self.own_inventory.users.add(self.user, self.admin)
        area = InventoryEntry.objects.create(name="Basement", type="area", inventory=self.own_inventory)
        InventoryEntry.objects.create(name="Drill", type="article", parent=area, inventory=self.own_inventory)
        InventoryEntry.objects.create(name="Saw", type="article", parent=area, inventory=self.own_inventory)

        self.other_inventory = Inventory.objects.create(name="Kitchen")
        self.other_inventory.users.add(self.admin)
        InventoryEntry.objects.create(name="Pantry", type="area", inventory=self.other_inventory)

    def scrape(self, user=None):
        if user is not None:
            _, secret = UserAPIKey.objects.create_key(name="prometheus", user=user)
            self.client.credentials(HTTP_AUTHORIZATION=f"Api-Key {secret}")
        return self.client.get("/api/metrics/")

    def samples(self, response):
        self.assertEqual(response.status_code, 200)
        lines = response.content.decode().splitlines()
        return {line for line in lines if line and not line.startswith("#")}

    def test_uses_the_prometheus_text_format(self):
        response = self.scrape(self.admin)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/plain; version=0.0.4; charset=utf-8")
        body = response.content.decode()
        self.assertTrue(body.endswith("\n"))
        self.assertIn("# TYPE openinvento_inventory_entries gauge\n", body)
        self.assertIn("# HELP openinvento_inventory_entries ", body)

    def test_answers_the_accept_headers_of_common_scrapers(self):
        accept_headers = (
            # Telegraf inputs.prometheus
            "application/vnd.google.protobuf;proto=io.prometheus.client.MetricFamily;encoding=delimited;q=0.7,"
            "text/plain;version=0.0.4;q=0.3",
            "application/openmetrics-text;version=1.0.0,application/openmetrics-text;version=0.0.1;q=0.75",
            "text/plain;version=0.0.4",
        )
        for accept in accept_headers:
            with self.subTest(accept=accept):
                self.client.credentials()
                self.assertEqual(self.client.get("/api/metrics/", HTTP_ACCEPT=accept).status_code, 401)

                _, secret = UserAPIKey.objects.create_key(name="prometheus", user=self.admin)
                self.client.credentials(HTTP_AUTHORIZATION=f"Api-Key {secret}")
                response = self.client.get("/api/metrics/", HTTP_ACCEPT=accept)

                self.assertEqual(response.status_code, 200)
                self.assertEqual(response["Content-Type"], "text/plain; version=0.0.4; charset=utf-8")

    def test_superuser_key_gets_instance_and_all_inventory_metrics(self):
        samples = self.samples(self.scrape(self.admin))

        self.assertIn('openinvento_users{state="active"} 2', samples)
        self.assertIn('openinvento_users{state="inactive"} 1', samples)
        self.assertIn("openinvento_inventories 2", samples)
        own, other = self.own_inventory.uuid, self.other_inventory.uuid
        self.assertIn(f'openinvento_inventory_entries{{inventory_uuid="{own}",type="article"}} 2', samples)
        self.assertIn(f'openinvento_inventory_entries{{inventory_uuid="{other}",type="area"}} 1', samples)
        self.assertIn(f'openinvento_inventory_members{{inventory_uuid="{own}"}} 2', samples)
        self.assertIn(f'openinvento_inventory_members{{inventory_uuid="{other}"}} 1', samples)

    def test_entry_types_without_entries_are_reported_as_zero(self):
        samples = self.samples(self.scrape(self.admin))

        own = self.own_inventory.uuid
        for entry_type in ("shelf", "box"):
            self.assertIn(f'openinvento_inventory_entries{{inventory_uuid="{own}",type="{entry_type}"}} 0', samples)

    def test_user_key_gets_only_the_users_inventories(self):
        response = self.scrape(self.user)
        samples = self.samples(response)
        body = response.content.decode()

        own = self.own_inventory.uuid
        self.assertIn(f'openinvento_inventory_entries{{inventory_uuid="{own}",type="area"}} 1', samples)
        self.assertIn(f'openinvento_inventory_members{{inventory_uuid="{own}"}} 2', samples)
        self.assertNotIn(str(self.other_inventory.uuid), body)
        self.assertNotIn("openinvento_users", body)
        self.assertNotIn("openinvento_inventories ", body)
        self.assertNotIn("openinvento_build_info", body)

    def test_info_metric_has_the_version_with_escaped_label_value(self):
        with patch.dict(os.environ, {"APP_VERSION": 'v1.5.0 "beta"\\x'}):
            samples = self.samples(self.scrape(self.admin))

        self.assertIn('openinvento_build_info{version="v1.5.0 \\"beta\\"\\\\x"} 1', samples)

    def test_info_metric_escapes_a_newline_in_the_version_label(self):
        with patch.dict(os.environ, {"APP_VERSION": "v1.5.0\nbeta"}):
            samples = self.samples(self.scrape(self.admin))

        self.assertIn('openinvento_build_info{version="v1.5.0\\nbeta"} 1', samples)

    def test_requires_an_api_key(self):
        self.assertEqual(self.scrape().status_code, 401)

        self.client.force_login(self.admin)
        self.assertEqual(self.client.get("/api/metrics/").status_code, 401)

    def test_revoked_key_is_rejected(self):
        api_key, secret = UserAPIKey.objects.create_key(name="prometheus", user=self.admin)
        api_key.revoked = True
        api_key.save()
        self.client.credentials(HTTP_AUTHORIZATION=f"Api-Key {secret}")

        self.assertEqual(self.client.get("/api/metrics/").status_code, 401)

    def test_is_hidden_while_the_module_is_disabled(self):
        settings = InstanceSettings.get_solo()
        settings.enabled_modules = []
        settings.save()

        self.assertEqual(self.scrape(self.admin).status_code, 404)
