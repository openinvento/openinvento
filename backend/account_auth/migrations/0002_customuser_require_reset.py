from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('account_auth', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='customuser',
            name='require_reset',
            field=models.BooleanField(default=False),
        ),
    ]