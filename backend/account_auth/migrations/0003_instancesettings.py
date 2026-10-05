from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('account_auth', '0002_customuser_require_reset'),
    ]

    operations = [
        migrations.CreateModel(
            name='InstanceSettings',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('allow_email_login', models.BooleanField(default=False)),
            ],
        ),
    ]