from django.db import migrations, models


def create_missing_table(apps, schema_editor):
    provider_model = apps.get_model("third_party_providers", "ThirdPartyProvider")
    table_name = provider_model._meta.db_table
    if table_name not in schema_editor.connection.introspection.table_names():
        schema_editor.create_model(provider_model)


class Migration(migrations.Migration):
    dependencies = [("third_party_providers", "0001_initial")]
    operations = [
        migrations.RunPython(create_missing_table, migrations.RunPython.noop),
        migrations.AddField(
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
        ),
    ]
