from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("third_party_providers", "0004_openfoodfacts_provider")]

    operations = [
        migrations.AddField(
            model_name="thirdpartyprovider",
            name="model_name",
            field=models.CharField(blank=True, max_length=200),
        ),
        migrations.AddField(
            model_name="thirdpartyprovider",
            name="api_url",
            field=models.URLField(blank=True, max_length=500),
        ),
        migrations.AlterField(
            model_name="thirdpartyprovider",
            name="provider",
            field=models.CharField(choices=[("gemini", "Google Gemini"), ("openfoodfacts", "Open Food Facts"), ("ollama", "Ollama")], max_length=40),
        ),
    ]
