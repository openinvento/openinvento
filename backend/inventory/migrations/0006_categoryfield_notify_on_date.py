from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0005_rename_chest_to_box"),
        ("loans", "0005_rename_chest_to_box"),
    ]

    operations = [
        migrations.AddField(
            model_name="categoryfield",
            name="notify_on_date",
            field=models.BooleanField(default=False),
        ),
    ]
