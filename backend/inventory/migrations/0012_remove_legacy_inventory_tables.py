from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("inventory", "0011_attach_features_to_entry"), ("loans", "0006_loan_inventory_entry")]
    operations = [
        migrations.DeleteModel(name="Article"),
        migrations.DeleteModel(name="Box"),
        migrations.DeleteModel(name="Shelf"),
        migrations.DeleteModel(name="Area"),
    ]
