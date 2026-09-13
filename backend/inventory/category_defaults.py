DEFAULT_CATEGORIES = {
    "Food": ({"key": "barcode", "label": "Barcode", "field_type": "barcode"},),
    "Books": ({"key": "author", "label": "Author", "field_type": "text"},),
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