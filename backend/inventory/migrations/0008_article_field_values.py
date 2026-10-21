from django.db import migrations, models
import django.db.models.deletion


def move_article_fields_to_rows(apps, schema_editor):
    Article = apps.get_model("inventory", "Article")
    CategoryField = apps.get_model("inventory", "CategoryField")
    ArticleFieldValue = apps.get_model("inventory", "ArticleFieldValue")
    database = schema_editor.connection.alias

    for article in Article.objects.using(database).all().iterator():
        values = article.custom_fields or {}
        notifications = article.date_notifications or {}
        for key in values.keys() | notifications.keys():
            value = values.get(key)
            fields = CategoryField.objects.using(database).filter(
                inventory_id=article.inventory_id,
                key=key,
            )
            if article.category_id:
                field = fields.filter(category_id=article.category_id).first()
            else:
                field = None
            if field is None:
                field = fields.filter(category__isnull=True).first()
            if field is None:
                continue

            ArticleFieldValue.objects.using(database).update_or_create(
                article_id=article.pk,
                field_id=field.pk,
                defaults={
                    "value": value,
                    "notify_on_date": bool(notifications.get(key, False)) if field.field_type == "date" else False,
                },
            )


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0007_article_date_notifications"),
    ]

    operations = [
        migrations.CreateModel(
            name="ArticleFieldValue",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("value", models.JSONField(blank=True, default=None, null=True)),
                ("notify_on_date", models.BooleanField(default=False)),
                ("article", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="field_values", to="inventory.article")),
                ("field", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="article_values", to="inventory.categoryfield")),
            ],
        ),
        migrations.AddConstraint(
            model_name="articlefieldvalue",
            constraint=models.UniqueConstraint(fields=("article", "field"), name="unique_article_field_value"),
        ),
        migrations.RunPython(move_article_fields_to_rows, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="article",
            name="custom_fields",
        ),
        migrations.RemoveField(
            model_name="article",
            name="date_notifications",
        ),
    ]
