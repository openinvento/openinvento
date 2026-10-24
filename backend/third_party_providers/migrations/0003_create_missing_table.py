from django.db import migrations


def create_missing_table(apps, schema_editor):
    provider_model = apps.get_model("third_party_providers", "ThirdPartyProvider")
    table_name = provider_model._meta.db_table
    if table_name not in schema_editor.connection.introspection.table_names():
        schema_editor.create_model(provider_model)


class Migration(migrations.Migration):
    dependencies = [("third_party_providers", "0002_thirdpartyprovider_type")]

    operations = [migrations.RunPython(create_missing_table, migrations.RunPython.noop)]