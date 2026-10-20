import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0004_articleattachment'),
        ('loans', '0004_alter_loan_article_alter_loan_chest'),
    ]

    operations = [
        migrations.RenameModel(
            old_name='Chest',
            new_name='Box',
        ),
        migrations.RenameField(
            model_name='box',
            old_name='parent_chest',
            new_name='parent_box',
        ),
        migrations.RenameField(
            model_name='article',
            old_name='chest',
            new_name='box',
        ),
        migrations.AlterField(
            model_name='box',
            name='area',
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='boxes', to='inventory.area'),
        ),
        migrations.AlterField(
            model_name='box',
            name='shelf',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name='boxes', to='inventory.shelf'),
        ),
        migrations.AlterField(
            model_name='box',
            name='parent_box',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='sub_boxes', to='inventory.box'),
        ),
        migrations.AlterField(
            model_name='article',
            name='box',
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='contained_articles', to='inventory.box'),
        ),
    ]
