import uuid

from django.db import models

from inventory.models import Inventory


class ThirdPartyProvider(models.Model):
    PROVIDERS = (("gemini", "Google Gemini"), ("openfoodfacts", "Open Food Facts"))
    TYPES = (
        ("barcode_lookup", "Barcode lookup"),
        ("object_detection_llm", "Object detection LLM"),
        ("llm", "LLM"),
    )

    uuid = models.UUIDField(default=uuid.uuid4, unique=True, primary_key=True, editable=False)
    inventory = models.ForeignKey(Inventory, on_delete=models.CASCADE, related_name="third_party_providers")
    provider = models.CharField(max_length=40, choices=PROVIDERS)
    type = models.CharField(max_length=40, choices=TYPES)
    name = models.CharField(max_length=100)
    # For DB operations use the api_key property, which will encrypt/decrypt automatically
    encrypted_api_key = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inventory_thirdpartyprovider"
        constraints = (models.UniqueConstraint(fields=("inventory", "provider", "name"), name="unique_inventory_provider_name"),)

    @property
    def api_key(self):
        from .secrets import decrypt_secret
        return decrypt_secret(self.encrypted_api_key)

    @api_key.setter
    def api_key(self, value):
        from .secrets import encrypt_secret
        self.encrypted_api_key = encrypt_secret(value)
