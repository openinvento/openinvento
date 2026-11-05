from django.test import TestCase

from inventory.models import Inventory

from .models import ThirdPartyProvider


class ProviderApiKeyTests(TestCase):
    def setUp(self):
        self.inventory = Inventory.objects.create(name="Home")

    def provider(self, name):
        return ThirdPartyProvider(inventory=self.inventory, provider="ollama", type="llm", name=name, model_name="m")

    def test_provider_without_key_returns_empty(self):
        provider = self.provider("no key")
        provider.save()
        provider.refresh_from_db()
        self.assertEqual(provider.api_key, "")

    def test_provider_with_key_returns_it(self):
        provider = self.provider("key")
        provider.api_key = "secret"
        provider.save()
        provider.refresh_from_db()
        self.assertNotIn("secret", provider.encrypted_api_key)
        self.assertEqual(provider.api_key, "secret")
