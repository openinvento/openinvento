import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("inventory", "0004_articleattachment"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="Loan",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("quantity", models.PositiveIntegerField(default=1)),
                ("lent_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("due_at", models.DateTimeField(blank=True, null=True)),
                ("returned_at", models.DateTimeField(blank=True, null=True)),
                ("notes", models.TextField(blank=True)),
                ("article", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="loans", to="inventory.article")),
                ("borrower", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="loans", to=settings.AUTH_USER_MODEL)),
                ("lent_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="issued_loans", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ("-lent_at",)},
        ),
    ]
