from django.contrib.auth import get_user_model
from django.utils import timezone

from account_auth.models import Notification
from inventory.models import Article, CategoryField, Inventory


def sync_date_field_notifications(user):
    """Create notifications for article date fields due today."""
    inventories = Inventory.objects.all() if user.is_superuser else user.inventories.all()
    fields = CategoryField.objects.filter(
        inventory__in=inventories,
        field_type="date",
    )
    today = timezone.localdate().isoformat()

    for field in fields:
        articles = Article.objects.filter(
            inventory_id=field.inventory_id,
            **{f"custom_fields__{field.key}": today},
            **{f"date_notifications__{field.key}": True},
        ).select_related("inventory")
        if field.category_id:
            articles = articles.filter(category_id=field.category_id)

        for article in articles:
            source_key = f"date-field:article:{article.uuid}:field:{field.uuid}:{today}"
            Notification.objects.update_or_create(
                user=user,
                source_key=source_key,
                defaults={
                    "kind": "date_reminder",
                    "title": f"Date reminder: {field.label}",
                    "message": f"{article.inventory.name}: {article.name} — {today}",
                    "link": f"/app/articles/{article.uuid}",
                    "metadata": {
                        "article_name": article.name,
                        "inventory_name": article.inventory.name,
                        "inventory_uuid": str(article.inventory_id),
                        "field_key": field.key,
                        "field_label": field.label,
                        "date": today,
                    },
                },
            )


def sync_all_date_field_notifications():
    for user in get_user_model().objects.all().iterator():
        sync_date_field_notifications(user)
