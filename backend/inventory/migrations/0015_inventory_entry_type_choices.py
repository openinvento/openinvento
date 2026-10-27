from django.db import migrations, models


def copy_type_keys_to_charfield(apps, schema_editor):
    database = schema_editor.connection.alias
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(
            "UPDATE inventory_inventoryentry "
            "SET type_id = (SELECT key FROM inventory_inventoryentrytype "
            "WHERE inventory_inventoryentrytype.id = inventory_inventoryentry.type_id)"
        )


class Migration(migrations.Migration):
    dependencies = [("inventory", "0014_entry_type_rules_live_in_code")]

    operations = [
        migrations.RunPython(copy_type_keys_to_charfield, migrations.RunPython.noop),
        migrations.RemoveField(model_name="inventoryentry", name="type"),
        migrations.DeleteModel(name="InventoryEntryType"),
        migrations.AddField(
            model_name="inventoryentry",
            name="type",
            field=models.CharField(
                choices=[("area", "Area"), ("shelf", "Shelf"), ("box", "Box"), ("article", "Article")],
                max_length=20,
                default="article",
            ),
            preserve_default=False,
        ),
    ]
