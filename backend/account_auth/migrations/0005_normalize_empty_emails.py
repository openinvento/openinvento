from django.db import migrations


def normalize_empty_emails(apps, schema_editor):
    CustomUser = apps.get_model('account_auth', 'CustomUser')
    CustomUser.objects.filter(email='').update(email=None)


class Migration(migrations.Migration):
    dependencies = [
        ('account_auth', '0004_alter_customuser_email'),
    ]

    operations = [
        migrations.RunPython(
            normalize_empty_emails,
            migrations.RunPython.noop,
        ),
    ]