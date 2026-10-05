from django.db import migrations, models


def move_minimum_quantity_to_custom_fields(apps, schema_editor):
    Article = apps.get_model("inventory", "Article")
    CategoryField = apps.get_model("inventory", "CategoryField")

    for article in Article.objects.exclude(minimum_quantity__isnull=True).iterator():
        custom_fields = dict(article.custom_fields or {})
        custom_fields.setdefault("minimum_quantity", article.minimum_quantity)
        Article.objects.filter(pk=article.pk).update(custom_fields=custom_fields)

    for inventory in apps.get_model("inventory", "Inventory").objects.all():
        CategoryField.objects.get_or_create(
            inventory=inventory,
            category=None,
            key="minimum_quantity",
            defaults={"label": "minimum_quantity", "field_type": "number", "options": []},
        )
        CategoryField.objects.get_or_create(
            inventory=inventory,
            category=None,
            key="stock_level",
            defaults={
                "label": "stock_level",
                "field_type": "select",
                "options": ["low", "medium", "high"],
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0002_article_custom_fields_alter_article_name_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="article",
            name="stock_tracking",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="categoryfield",
            name="options",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AlterField(
            model_name="categoryfield",
            name="field_type",
            field=models.CharField(
                choices=[
                    ("text", "Text"),
                    ("number", "Number"),
                    ("boolean", "Boolean"),
                    ("date", "Date"),
                    ("barcode", "Barcode"),
                    ("select", "Select"),
                ],
                default="text",
                max_length=20,
            ),
        ),
        migrations.RunPython(move_minimum_quantity_to_custom_fields, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="article",
            name="minimum_quantity",
        ),
    ]