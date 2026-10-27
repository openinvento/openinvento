from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("inventory", "0013_alter_articleattachment_file_and_more")]
    operations = [
        migrations.RemoveField(model_name="inventoryentrytype", name="name"),
        migrations.RemoveField(model_name="inventoryentrytype", name="allowed_parent_types"),
        migrations.RemoveField(model_name="inventoryentrytype", name="allowed_child_types"),
        migrations.RemoveField(model_name="inventoryentrytype", name="allow_root"),
    ]
