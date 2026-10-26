from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("third_party_providers", "0003_create_missing_table")]

    operations = [migrations.AlterField(
        model_name="thirdpartyprovider",
        name="provider",
        field=models.CharField(choices=[("gemini", "Google Gemini"), ("openfoodfacts", "Open Food Facts")], max_length=40),
    )]
