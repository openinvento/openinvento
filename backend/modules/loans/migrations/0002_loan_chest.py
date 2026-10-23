import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("loans", "0001_initial")]

    operations = [
        migrations.AlterField(
            model_name="loan",
            name="article",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="loans",
                to="inventory.article",
            ),
        ),
        migrations.AddField(
            model_name="loan",
            name="chest",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="loans",
                to="inventory.chest",
            ),
        ),
        migrations.AddConstraint(
            model_name="loan",
            constraint=models.CheckConstraint(
                condition=(
                    models.Q(article__isnull=False, chest__isnull=True)
                    | models.Q(article__isnull=True, chest__isnull=False)
                ),
                name="loan_exactly_one_item",
            ),
        ),
    ]
