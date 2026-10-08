from django.db import migrations, models


def normalize_empty_emails(apps, schema_editor):
    CustomUser = apps.get_model('account_auth', 'CustomUser')
    CustomUser.objects.filter(email='').update(email=None)


class Migration(migrations.Migration):
    dependencies = [
        ('account_auth', '0005_normalize_empty_emails'),
    ]

    operations = [
        migrations.AlterField(
            model_name='customuser',
            name='email',
            field=models.EmailField(default=None, blank=True, null=True, unique=True),
        ),
        migrations.RunPython(
            normalize_empty_emails,
            migrations.RunPython.noop,
        ),
    ]