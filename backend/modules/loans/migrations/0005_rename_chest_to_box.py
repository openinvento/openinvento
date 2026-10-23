import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0005_rename_chest_to_box'),
        ('loans', '0004_alter_loan_article_alter_loan_chest'),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name='loan',
            name='loan_exactly_one_item',
        ),
        migrations.RenameField(
            model_name='loan',
            old_name='chest',
            new_name='box',
        ),
        migrations.AlterField(
            model_name='loan',
            name='box',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='loans', to='inventory.box'),
        ),
        migrations.AddConstraint(
            model_name='loan',
            constraint=models.CheckConstraint(
                condition=models.Q(article__isnull=False, box__isnull=True) | models.Q(article__isnull=True, box__isnull=False),
                name='loan_exactly_one_item',
            ),
        ),
    ]
