import django.db.models.deletion
from django.db import migrations, models


def copy_loan_entities(apps, schema_editor):
    Loan = apps.get_model("loans", "Loan")
    database = schema_editor.connection.alias
    for loan in Loan.objects.using(database).all().iterator():
        item_id = loan.article_id or loan.box_id
        if item_id:
            Loan.objects.using(database).filter(pk=loan.pk).update(entry_id=item_id)


class Migration(migrations.Migration):
    dependencies = [("inventory", "0010_inventoryentry"), ("loans", "0005_rename_chest_to_box")]
    operations = [
        migrations.AddField(model_name="loan", name="entry", field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="loans", to="inventory.inventoryentry")),
        migrations.RunPython(copy_loan_entities, migrations.RunPython.noop),
        migrations.RemoveConstraint(model_name="loan", name="loan_exactly_one_item"),
        migrations.RemoveField(model_name="loan", name="article"),
        migrations.RemoveField(model_name="loan", name="box"),
        migrations.AlterField(model_name="loan", name="entry", field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="loans", to="inventory.inventoryentry")),
    ]
