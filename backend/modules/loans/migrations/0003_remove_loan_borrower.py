from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("loans", "0002_loan_chest")]

    operations = [migrations.RemoveField(model_name="loan", name="borrower")]
