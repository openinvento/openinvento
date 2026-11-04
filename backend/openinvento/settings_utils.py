"""Parsers for environment variables that need more than a flag or a list (used by settings.py).

Nothing here may import Django models: settings.py loads this module before the apps are ready.
"""

import json
import os
import uuid

from django.core.exceptions import ImproperlyConfigured


def group_inventories_env(name):
    """Parse the explicit group mapping, a JSON object {"<group>": "<inventory uuid>"}.

    JSON because group names may contain commas, "=" or ":". Any invalid entry stops the start:
    dropping it would release the inventory it protects, and a typo must never bind an
    unexpected inventory.
    """
    raw_value = os.getenv(name, "").strip()
    if not raw_value:
        return {}
    try:
        value = json.loads(raw_value)
    except json.JSONDecodeError as exc:
        raise ImproperlyConfigured(f"{name} is not valid JSON: {exc}") from exc
    if not isinstance(value, dict):
        raise ImproperlyConfigured(f"{name} must be a JSON object of group names to inventory UUIDs.")
    mapping, inventories = {}, set()
    for group, inventory in value.items():
        try:
            inventory = str(uuid.UUID(str(inventory)))
        except ValueError as exc:
            raise ImproperlyConfigured(f"{name}: {inventory!r} for group {group!r} is not an inventory UUID.") from exc
        # Two groups for one inventory would rebind it on every login.
        if inventory in inventories:
            raise ImproperlyConfigured(f"{name} maps inventory {inventory} to more than one group ({group!r}).")
        inventories.add(inventory)
        mapping[group] = inventory
    return mapping
