from inventory.models import Inventory

from .models import Notification


def create_user_inventory(user):
    inventory = Inventory.objects.create(name=f"{user.username}'s Inventory")
    user.inventories.add(inventory)
    return inventory


def create_notification(user, *, kind, title, message="", link="", metadata=None, source_key=""):
    """Create a user notification, optionally idempotently by source key."""
    defaults = {
        "kind": kind,
        "title": title,
        "message": message,
        "link": link,
        "metadata": metadata or {},
    }
    if source_key:
        notification, _ = Notification.objects.get_or_create(
            user=user,
            source_key=source_key,
            defaults=defaults,
        )
        return notification
    return Notification.objects.create(user=user, source_key="", **defaults)
