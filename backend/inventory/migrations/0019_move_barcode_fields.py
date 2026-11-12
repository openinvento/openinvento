from django.db import migrations

from inventory.barcodes import BarcodeKind, detect_kind, is_valid, normalize

# The default category fields that held a product barcode, and the type of their values.
BARCODE_FIELDS = (
    ("food", "barcode", BarcodeKind.EAN),
    ("books", "isbn", BarcodeKind.ISBN),
    ("medicine", "pzn_barcode", BarcodeKind.PZN),
)


def _as_text(value):
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return "" if value is None or isinstance(value, (bool, dict, list)) else str(value).strip()


def classify(value, expected_kind):
    """The field's own type if the value is valid for it, then a guess, and `other` if nothing fits."""
    for kind in (expected_kind, detect_kind(value)):
        normalized = normalize(kind, value)
        if kind != BarcodeKind.OTHER and is_valid(kind, normalized):
            return kind, normalized
    return BarcodeKind.OTHER, normalize(BarcodeKind.OTHER, value)


def move_barcode_fields(apps, schema_editor):
    """Copy the values into the barcode table, then remove the fields, so nothing is lost or shown twice."""
    Barcode = apps.get_model("inventory", "Barcode")
    CategoryField = apps.get_model("inventory", "CategoryField")
    ArticleFieldValue = apps.get_model("inventory", "ArticleFieldValue")

    for category_name, key, kind in BARCODE_FIELDS:
        fields = CategoryField.objects.filter(category__name=category_name, key=key)
        for field_value in ArticleFieldValue.objects.filter(field__in=fields):
            value = _as_text(field_value.value)[:80]
            if not value:
                continue
            barcode_kind, normalized = classify(value, kind)
            Barcode.objects.get_or_create(
                entry_id=field_value.entry_id, value=normalized, defaults={"kind": barcode_kind}
            )
        fields.delete()


class Migration(migrations.Migration):

    dependencies = [
        ("inventory", "0018_barcode"),
    ]

    operations = [
        # Not reversible: the values stay in the barcode table, but the fields aren't recreated.
        migrations.RunPython(move_barcode_fields, migrations.RunPython.noop),
    ]
