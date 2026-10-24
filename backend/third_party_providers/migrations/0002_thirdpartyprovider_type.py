from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("third_party_providers", "0001_initial")]
    operations = [migrations.AddField(
        model_name="thirdpartyprovider",
        name="type",
        field=models.CharField(
            choices=[
                ("barcode_lookup", "Barcode lookup"),
                ("object_detection_llm", "Object detection LLM"),
                ("llm", "LLM"),
            ],
            default="object_detection_llm",
            max_length=40,
        ),
        preserve_default=False,
    )]
