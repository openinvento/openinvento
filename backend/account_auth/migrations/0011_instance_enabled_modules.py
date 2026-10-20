from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("account_auth", "0010_user_api_key")]

    operations = [
        migrations.AddField(
            model_name="instancesettings",
            name="enabled_modules",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
