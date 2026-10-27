from django.contrib.auth import get_user_model
from django.utils import timezone

from account_auth.models import Notification
from inventory.models import ArticleFieldValue, Inventory


def sync_date_field_notifications(user):
    """Create reminders for enabled article date fields due today."""
    inventories = Inventory.objects.all() if user.is_superuser else user.inventories.all()
    today = timezone.localdate().isoformat()
    field_values = ArticleFieldValue.objects.filter(
        entry__inventory__in=inventories,
        field__field_type="date",
        notify_on_date=True,
        value=today,
    ).select_related("entry__inventory", "entry__category", "field")
    
    for field_value in field_values:
        article = field_value.entry
        field = field_value.field
        if field.category_id not in (None, article.category_id):
            continue

        source_key = f"date-field:article:{article.uuid}:field:{field.uuid}:{today}"
        Notification.objects.update_or_create(
            user=user,
            source_key=source_key,
            defaults={
                "kind": "date_reminder",
                "title": f"Date reminder: {field.label}",
                "message": f"{article.inventory.name}: {article.name} - {today}",
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
