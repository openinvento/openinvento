"""Prometheus text format endpoint with counts computed from the database on every scrape."""

from django.db.models import Count
from django.http import HttpResponse
from rest_framework.negotiation import BaseContentNegotiation
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from account_auth.authentication import (
    StandardOrAPIKeyAuthMixin,
)
from account_auth.models import CustomUser
from inventory.models import Inventory, InventoryEntry, InventoryEntryType
from openinvento.instance_notifications import get_current_version

CONTENT_TYPE = "text/plain; version=0.0.4; charset=utf-8"


def _label_value(value):
    return str(value).replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")


def _metric(name, help_text, samples):
    """Render one gauge; samples are (labels dict, value) pairs."""
    lines = [f"# HELP {name} {help_text}", f"# TYPE {name} gauge"]
    for labels, value in samples:
        label_text = ",".join(f'{key}="{_label_value(val)}"' for key, val in labels.items())
        lines.append(f"{name}{{{label_text}}} {value}" if label_text else f"{name} {value}")
    return lines


def render_metrics(user):
    """Instance metrics for superusers; inventory metrics for every inventory the user may see."""
    lines = []
    inventories = Inventory.objects.all() if user.is_superuser else Inventory.objects.filter(users=user)

    if user.is_superuser:
        active = CustomUser.objects.filter(is_active=True).count()
        inactive = CustomUser.objects.filter(is_active=False).count()
        lines += _metric("openinvento_build_info", "OpenInvento version.", [({"version": get_current_version()}, 1)])
        lines += _metric(
            "openinvento_users",
            "Number of user accounts.",
            [({"state": "active"}, active), ({"state": "inactive"}, inactive)],
        )
        lines += _metric("openinvento_inventories", "Number of inventories.", [({}, inventories.count())])

    # Count members on a fresh queryset: annotating the users=user filter would only count that join.
    members = dict(
        Inventory.objects.filter(uuid__in=inventories)
        .annotate(count=Count("users"))
        .order_by("uuid")
        .values_list("uuid", "count")
    )
    counts = {
        (row["inventory"], row["type"]): row["count"]
        for row in InventoryEntry.objects.filter(inventory__in=inventories)
        .values("inventory", "type")
        .annotate(count=Count("uuid"))
    }
    lines += _metric(
        "openinvento_inventory_entries",
        "Number of inventory entries per type.",
        [
            ({"inventory_uuid": uuid, "type": entry_type}, counts.get((uuid, entry_type), 0))
            for uuid in members
            for entry_type in InventoryEntryType.values
        ],
    )
    lines += _metric(
        "openinvento_inventory_members",
        "Number of users with access to the inventory.",
        [({"inventory_uuid": uuid}, count) for uuid, count in members.items()],
    )
    return "\n".join(lines) + "\n"


class IgnoreAcceptHeader(BaseContentNegotiation):
    """Always answer; scrapers such as Telegraf send Accept headers without */* that no DRF renderer matches."""

    def select_parser(self, request, parsers):
        return parsers[0]

    def select_renderer(self, request, renderers, format_suffix=None):
        return renderers[0], renderers[0].media_type


class MetricsView(StandardOrAPIKeyAuthMixin, APIView):
    # Scrapers have no session, so they use an API key; signed-in users can open it in the browser.
    permission_classes = (IsAuthenticated,)
    content_negotiation_class = IgnoreAcceptHeader

    def get(self, request):
        return HttpResponse(render_metrics(request.user), content_type=CONTENT_TYPE)
