import uuid

from rest_framework.exceptions import ValidationError


def inventory_uuid_param(value, field="inventory"):
    """The inventory UUID from a request parameter, or None if it's missing.

    Filtering by a malformed UUID raises a ValidationError in the database layer, which became a
    500 with a debug page. A malformed value is the client's mistake, so it's a 400 instead.
    """
    if value in (None, ""):
        return None
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        raise ValidationError({field: ["Must be a valid UUID."]}) from None
