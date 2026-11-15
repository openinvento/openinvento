from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('account_auth', '0012_oidc_identity'),
    ]

    operations = [
        migrations.AddField(
            model_name='instancesettings',
            name='qr_codes_include_url',
            field=models.BooleanField(default=True),
        ),
    ]
