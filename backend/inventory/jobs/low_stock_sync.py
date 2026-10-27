from django.contrib.auth import get_user_model

from account_auth.models import Notification
from inventory.models import Inventory, InventoryEntry


def sync_low_stock_notifications(user):
    inventories = Inventory.objects.all() if user.is_superuser else user.inventories.all()
    articles = InventoryEntry.objects.filter(
        inventory__in=inventories,
        type__key="article",
        stock_tracking=True,
    ).select_related("inventory").prefetch_related("field_values__field")

    active_source_keys = set()
    for article in articles:
        minimum = next(
            (
                field_value.value
                for field_value in article.field_values.all()
                if field_value.field.key == "minimum_quantity"
            ),
            None,
        )
        if not isinstance(minimum, (int, float)) or article.quantity > minimum:
            continue

        source_key = f"low-stock:article:{article.uuid}"
        active_source_keys.add(source_key)
        Notification.objects.update_or_create(
            user=user,
            source_key=source_key,
            defaults={
                "kind": "low_stock",
                "title": f"Low stock: {article.name}",
                "message": f"{article.inventory.name}: {article.quantity} left (minimum {minimum})",
                "link": f"/app/articles/{article.uuid}",
                "metadata": {
                    "article_name": article.name,
                    "inventory_name": article.inventory.name,
                    "inventory_uuid": str(article.inventory_id),
                    "quantity": article.quantity,
                    "minimum_quantity": minimum,
                },
            },
        )

    stale = Notification.objects.filter(
        user=user,
        kind="low_stock",
        source_key__startswith="low-stock:article:",
    )
    if active_source_keys:
        stale = stale.exclude(source_key__in=active_source_keys)
    stale.delete()


def sync_all_low_stock_notifications():
    for user in get_user_model().objects.all().iterator():
        sync_low_stock_notifications(user)
