"""This module defines default categories and their associated fields for an inventory system."""

DEFAULT_CATEGORIES = {
    "food": (
        {"key": "barcode", "label": "barcode", "field_type": "barcode"},
        {"key": "expiration_date", "label": "expiration_date", "field_type": "date"},
    ),
    "books": (
        {"key": "isbn", "label": "isbn", "field_type": "barcode"},
        {"key": "author", "label": "author", "field_type": "text"},
        {"key": "pages", "label": "pages", "field_type": "number"},
        {"key": "read_status", "label": "read_status", "field_type": "boolean"},
    ),
    "electronics": (
        {"key": "serial_number", "label": "serial_number", "field_type": "barcode"},
        {"key": "purchase_date", "label": "purchase_date", "field_type": "date"},
        {"key": "warranty_months", "label": "warranty_months", "field_type": "number"},
        {"key": "has_insurance", "label": "has_insurance", "field_type": "boolean"},
    ),
    "clothing": (
        {"key": "brand", "label": "brand", "field_type": "text"},
        {"key": "size", "label": "size", "field_type": "text"},
        {"key": "quantity", "label": "quantity", "field_type": "number"},
    ),
    "medicine": (
        {"key": "pzn_barcode", "label": "pzn_barcode", "field_type": "barcode"},
        {"key": "expiry", "label": "expiry", "field_type": "date"},
        {"key": "prescription_required", "label": "prescription_required", "field_type": "boolean"},
    ),
}


def ensure_default_categories(inventory):
    from .models import ArticleCategory, CategoryField

    for category_name, fields in DEFAULT_CATEGORIES.items():
        category, _ = ArticleCategory.objects.get_or_create(
            inventory=inventory,
            name=category_name,
        )
        for field in fields:
            CategoryField.objects.get_or_create(
                inventory=inventory,
                category=category,
                key=field["key"],
                defaults={"label": field["label"], "field_type": field["field_type"]},
            )