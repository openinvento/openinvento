from django.db import migrations, models


def resolve_duplicate_identifiers(apps, schema_editor):
    InventoryEntry = apps.get_model('inventory', 'InventoryEntry')
    duplicates = (
        InventoryEntry.objects.values('inventory_id', 'identifier')
        .annotate(count=models.Count('uuid'))
        .filter(count__gt=1)
    )
    for dup in duplicates:
        entries = InventoryEntry.objects.filter(
            inventory_id=dup['inventory_id'], 
            identifier=dup['identifier']
        ).order_by('created_at')
        for index, entry in enumerate(entries[1:], start=2):
            new_identifier = f"{dup['identifier']}_{index}"
            while InventoryEntry.objects.filter(inventory_id=dup['inventory_id'], identifier=new_identifier).exists():
                index += 1
                new_identifier = f"{dup['identifier']}_{index}"
            entry.identifier = new_identifier
            entry.save(update_fields=['identifier'])


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0015_inventory_entry_type_choices'),
    ]

    operations = [
        migrations.RunPython(resolve_duplicate_identifiers, reverse_code=migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name='inventoryentry',
            constraint=models.UniqueConstraint(fields=('identifier', 'inventory'), name='unique_inventory_entry_identifier'),
        ),
    ]
