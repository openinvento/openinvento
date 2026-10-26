import django.core.validators
import django.db.models.deletion
import inventory.models
import uuid
from django.db import migrations, models


def copy_inventory_objects(apps, schema_editor):
    database = schema_editor.connection.alias
    InventoryEntry = apps.get_model("inventory", "InventoryEntry")
    InventoryEntryType = apps.get_model("inventory", "InventoryEntryType")
    type_parent_rules = {
        "area": [], "shelf": ["area"], "box": ["area", "shelf", "box"],
        "article": ["area", "shelf", "box", "article"],
    }
    type_child_rules = {
        "area": ["shelf", "box", "article"], "shelf": ["box", "article"],
        "box": ["box", "article"], "article": ["article"],
    }
    root_types = {"area", "article"}
    type_rows = {}
    for key, allowed in type_parent_rules.items():
        type_rows[key], _ = InventoryEntryType.objects.using(database).get_or_create(
            key=key, defaults={"name": key.title(), "allowed_parent_types": allowed,
                               "allowed_child_types": type_child_rules[key], "allow_root": key in root_types}
        )
    mapping = {}
    for model_name, entry_type in (("Area", "area"), ("Shelf", "shelf"), ("Box", "box"), ("Article", "article")):
        Model = apps.get_model("inventory", model_name)
        for old in Model.objects.using(database).all().iterator():
            entry = InventoryEntry(
                uuid=old.uuid,
                identifier=old.identifier,
                inventory_id=old.inventory_id,
                name=old.name,
                type_id=type_rows[entry_type].pk,
                created_at=old.created_at,
                updated_at=old.updated_at,
            )
            if entry_type == "article":
                entry.description = old.description
                entry.quantity = old.quantity
                entry.stock_tracking = old.stock_tracking
                entry.image = old.image
                entry.icon = old.icon
                entry.category_id = old.category_id
            mapping[(model_name, old.uuid)] = entry
            entry.save(using=database)
            InventoryEntry.objects.using(database).filter(pk=entry.pk).update(
                created_at=old.created_at, updated_at=old.updated_at
            )
    for model_name, entry_type in (("Area", "area"), ("Shelf", "shelf"), ("Box", "box"), ("Article", "article")):
        Model = apps.get_model("inventory", model_name)
        for old in Model.objects.using(database).all().iterator():
            entry = mapping[(model_name, old.uuid)]
            if entry_type == "shelf":
                entry.parent_id = old.area_id
            elif entry_type == "box":
                entry.parent_id = old.parent_box_id or old.shelf_id or old.area_id
            elif entry_type == "article":
                entry.parent_id = old.box_id or old.shelf_id or old.area_id
            InventoryEntry.objects.using(database).filter(pk=entry.pk).update(
                parent_id=entry.parent_id
            )
    # Preserve field values and attachments by retargeting them in a later migration.


class Migration(migrations.Migration):
    dependencies = [("inventory", "0009_alter_articleattachment_file")]
    operations = [
        migrations.CreateModel(
            name="InventoryEntryType",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("key", models.CharField(choices=[("area", "Area"), ("shelf", "Shelf"), ("box", "Box"), ("article", "Article")], max_length=20, unique=True)),
                ("name", models.CharField(max_length=50)),
                ("allowed_parent_types", models.JSONField(blank=True, default=list)),
                ("allowed_child_types", models.JSONField(blank=True, default=list)),
                ("allow_root", models.BooleanField(default=False)),
            ],
            options={"ordering": ("key",)},
        ),
        migrations.CreateModel(
            name="InventoryEntry",
            fields=[
                ("uuid", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True)),
                ("identifier", models.CharField(blank=True, max_length=30)),
                ("name", models.CharField(max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("description", models.CharField(blank=True, max_length=750, null=True)),
                ("quantity", models.IntegerField(default=1)),
                ("stock_tracking", models.BooleanField(default=False)),
                ("image", models.ImageField(blank=True, null=True, upload_to=inventory.models.article_image_upload_path, validators=[django.core.validators.FileExtensionValidator(allowed_extensions=["jpg", "jpeg", "png"]), inventory.models.validate_file_size, inventory.models.validate_pure_image])),
                ("icon", models.CharField(blank=True, max_length=40, null=True)),
                ("category", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to="inventory.articlecategory")),
                ("inventory", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="entries", to="inventory.inventory")),
                ("parent", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="children", to="inventory.inventoryentry")),
                ("type", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="entries", to="inventory.inventoryentrytype")),
            ],
            options={"ordering": ("name",)},
        ),
        migrations.RunPython(copy_inventory_objects, migrations.RunPython.noop),
    ]
