from django.db import migrations, models


def move_date_notification_preferences(apps, schema_editor):
    Article = apps.get_model("inventory", "Article")
    CategoryField = apps.get_model("inventory", "CategoryField")
    database = schema_editor.connection.alias

    fields = list(
        CategoryField.objects.using(database).filter(field_type="date", notify_on_date=True)
    )
    if not fields:
        return

    for article in Article.objects.using(database).all().iterator():
        enabled_keys = [
            field.key
            for field in fields
            if field.inventory_id == article.inventory_id
            and (field.category_id is None or field.category_id == article.category_id)
        ]
        if enabled_keys:
            article.date_notifications = {key: True for key in enabled_keys}
            article.save(using=database, update_fields=["date_notifications"])


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0006_categoryfield_notify_on_date"),
        ("loans", "0005_rename_chest_to_box"),
    ]

    operations = [
        migrations.AddField(
            model_name="article",
            name="date_notifications",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.RunPython(move_date_notification_preferences, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="categoryfield",
            name="notify_on_date",
        ),
    ]
