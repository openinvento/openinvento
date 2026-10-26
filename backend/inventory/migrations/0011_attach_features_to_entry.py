import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("inventory", "0010_inventoryentry")]
    operations = [
        migrations.RemoveConstraint(model_name="articlefieldvalue", name="unique_article_field_value"),
        migrations.RenameField(model_name="articleattachment", old_name="article", new_name="entry"),
        migrations.AlterField(model_name="articleattachment", name="entry", field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="attachments", to="inventory.inventoryentry")),
        migrations.RenameField(model_name="articlefieldvalue", old_name="article", new_name="entry"),
        migrations.AlterField(model_name="articlefieldvalue", name="entry", field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="field_values", to="inventory.inventoryentry")),
        migrations.AddConstraint(model_name="articlefieldvalue", constraint=models.UniqueConstraint(fields=("entry", "field"), name="unique_entry_field_value")),
    ]
