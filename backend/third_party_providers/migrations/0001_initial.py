import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    operations = [migrations.CreateModel(
            name="ThirdPartyProvider",
            fields=[
                ("uuid", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True)),
                ("provider", models.CharField(choices=[("gemini", "Google Gemini")], max_length=40)),
                ("name", models.CharField(max_length=100)),
                ("encrypted_api_key", models.TextField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("inventory", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="third_party_providers", to="inventory.inventory")),
            ],
            options={"db_table": "inventory_thirdpartyprovider", "constraints": [models.UniqueConstraint(fields=("inventory", "provider", "name"), name="unique_inventory_provider_name")]},
        )]
