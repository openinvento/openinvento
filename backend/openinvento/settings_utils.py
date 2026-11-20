""" Utilities for parsing and validating environment variables for OpenInvento settings. """

import json
import os
import uuid
from urllib.parse import urlsplit

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
        value = json.loads(raw_value, object_pairs_hook=lambda pairs: _reject_repeated_keys(name, pairs))
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


def _reject_repeated_keys(name, pairs):
    # json.loads keeps only the last value of a repeated key, which would drop an entry silently.
    keys = [key for key, _ in pairs]
    repeated = sorted({key for key in keys if keys.count(key) > 1})
    if repeated:
        raise ImproperlyConfigured(f"{name} lists group {repeated[0]!r} more than once.")
    return dict(pairs)


def _normalize_app_url(value):
    """Return an origin from a URL or host[:port], defaulting bare hosts to HTTP."""
    value = value.strip()
    if not value:
        return ""

    if "://" not in value:
        value = "http://" + value
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError(
            f"Invalid application URL {value!r}: use a hostname with optional http:// or https://"
        )
    # An origin has no path, query, or fragment. Keep an explicitly supplied port.
    return f"{parsed.scheme}://{parsed.netloc}"


def _normalize_scan_base_url(value):
    """Like _normalize_app_url, but reject a path instead of dropping it: it would be on every label."""
    origin = _normalize_app_url(value)
    if origin:
        value = value.strip()
        parsed = urlsplit(value if "://" in value else "http://" + value)
        if parsed.path not in ("", "/") or parsed.query or parsed.fragment:
            raise ValueError(
                f"Invalid SCAN_BASE_URL {value!r}: use an origin without a path, like https://short.example"
            )
    return origin


def _host_from_url(value):
    """Return the host Django expects in ALLOWED_HOSTS (no scheme or port)."""
    candidate = value if "://" in value else "//" + value
    parsed = urlsplit(candidate)
    hostname = parsed.hostname
    if hostname is None:
        return value.split("/", 1)[0]
    # Django expects IPv6 hosts in ALLOWED_HOSTS to retain their brackets.
    if ":" in hostname:
        return f"[{hostname}]"
    return hostname
