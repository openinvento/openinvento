from django.db import migrations, models


def copy_type_keys_to_charfield(apps, schema_editor):
    database = schema_editor.connection.alias
    InventoryEntry = apps.get_model("inventory", "InventoryEntry")
    InventoryEntryType = apps.get_model("inventory", "InventoryEntryType")
    type_keys = {
        entry_type.pk: entry_type.key
        for entry_type in InventoryEntryType.objects.using(database).all()
    }
    for entry in InventoryEntry.objects.using(database).all().iterator():
        entry.type_key = type_keys[entry.type_id]
        entry.save(using=database, update_fields=["type_key"])


class Migration(migrations.Migration):
    dependencies = [("inventory", "0014_entry_type_rules_live_in_code")]

    operations = [
        migrations.AddField(
            model_name="inventoryentry",
            name="type_key",
            field=models.CharField(max_length=20, null=True),
        ),
        migrations.RunPython(copy_type_keys_to_charfield, migrations.RunPython.noop),
        migrations.RemoveField(model_name="inventoryentry", name="type"),
        migrations.DeleteModel(name="InventoryEntryType"),
        migrations.RenameField(
            model_name="inventoryentry",
            old_name="type_key",
            new_name="type",
        ),
        migrations.AlterField(
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
