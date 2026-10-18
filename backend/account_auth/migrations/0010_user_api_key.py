from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("account_auth", "0009_notification_metadata"),
        ("rest_framework_api_key", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="UserAPIKey",
            fields=[
                ("id", models.CharField(editable=False, max_length=150, primary_key=True, serialize=False, unique=True)),
                ("prefix", models.CharField(editable=False, max_length=8, unique=True)),
                ("hashed_key", models.CharField(editable=False, max_length=150)),
                ("created", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("name", models.CharField(default=None, help_text="A free-form name for the API key. Need not be unique. 50 characters max.", max_length=50)),
                ("revoked", models.BooleanField(blank=True, default=False, help_text="If the API key is revoked, clients cannot use it anymore. (This cannot be undone.)")),
                ("expiry_date", models.DateTimeField(blank=True, help_text="Once API key expires, clients cannot use it anymore.", null=True, verbose_name="Expires")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="api_keys", to=settings.AUTH_USER_MODEL)),
            ],
            options={"abstract": False, "ordering": ("-created",), "verbose_name": "API key", "verbose_name_plural": "API keys"},
        ),
    ]
