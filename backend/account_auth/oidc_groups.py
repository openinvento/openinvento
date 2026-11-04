"""Groups claim handling on OIDC login: allowed groups, admin group and inventory sync.

An inventory is managed when it is bound to a group that the settings still name (see
Inventory.oidc_managed): a group in OIDC_GROUP_INVENTORIES binds the mapped inventory, a group
matching OIDC_INVENTORY_GROUP_PREFIX gets its own inventory. Members of managed inventories come
from the provider only; inventories without a binding are never touched.

Everything runs on login only. Sessions and API keys keep their access until the next login;
real-time deprovisioning would need SCIM (RFC 7643/7644).
"""

import logging

from django.conf import settings

from inventory.models import Inventory, is_prefix_group

from .models import CustomUser
from .services import create_user_inventory

logger = logging.getLogger(__name__)

GROUP_MAX_LENGTH = Inventory._meta.get_field("oidc_group").max_length
INVENTORY_NAME_MAX_LENGTH = Inventory._meta.get_field("name").max_length


def group_settings_used():
    return bool(settings.OIDC_GROUP_SYNC or settings.OIDC_ALLOWED_GROUPS or settings.OIDC_ADMIN_GROUP)


def get_groups(claims):
    """Return the user's groups, or None if the claim is missing or not a list of strings.

    A missing claim is usually a misconfiguration (scope not requested, mapper missing, Microsoft
    Entra ID groups overage); treating it as "no groups" would empty every managed inventory.
    An empty list is a real answer: the user is in no group. Names are compared exactly.
    """
    value = claims.get(settings.OIDC_GROUPS_CLAIM)
    # Some providers send a plain string for exactly one group.
    if isinstance(value, str):
        return {value}
    if isinstance(value, list) and all(isinstance(group, str) for group in value):
        return set(value)
    return None


def login_allowed(groups):
    """Whether OIDC_ALLOWED_GROUPS lets the user in; without a usable claim nobody is let in."""
    if not settings.OIDC_ALLOWED_GROUPS:
        return True
    return groups is not None and not groups.isdisjoint(settings.OIDC_ALLOWED_GROUPS)


def apply_group_claims(user, groups):
    """Update admin access and inventory membership from the groups claim after an OIDC login."""
    if groups is None:
        if group_settings_used():
            logger.warning(
                "OIDC login of user %s has no usable %r claim; admin access and inventory memberships are unchanged.",
                user.pk,
                settings.OIDC_GROUPS_CLAIM,
            )
    else:
        if settings.OIDC_ADMIN_GROUP:
            sync_admin_access(user, groups)
        if settings.OIDC_GROUP_SYNC:
            sync_inventory_memberships(user, groups)
    # With group sync, the personal inventory is only created for users who end up in no inventory,
    # so group members do not get an extra empty inventory next to their group's.
    if settings.OIDC_GROUP_SYNC and not user.inventories.exists():
        create_user_inventory(user)


def sync_admin_access(user, groups):
    is_admin = settings.OIDC_ADMIN_GROUP in groups
    if user.is_superuser == is_admin:
        return
    if not is_admin and not CustomUser.objects.filter(is_superuser=True, is_active=True).exclude(pk=user.pk).exists():
        logger.warning("OIDC_ADMIN_GROUP: user %s keeps admin access as the last active administrator.", user.pk)
        return
    # Same pair of flags as AdminUserSerializer sets.
    user.is_superuser = user.is_staff = is_admin
    user.save(update_fields=["is_superuser", "is_staff"])


def sync_inventory_memberships(user, groups):
    """Add the user to the inventories of their groups and remove them from other managed ones.

    Removal goes through users.remove() directly, never through the members API, which deletes an
    inventory once its last member leaves: a managed inventory without members keeps its data.
    """
    targets, unresolved = [], set()
    # Mapped groups first: a mapping can take over an inventory that a prefix group is bound to,
    # and the prefix group then gets its new inventory in the same login.
    for group in sorted(groups, key=lambda group: (group not in settings.OIDC_GROUP_INVENTORIES, group)):
        inventory = bind_inventory(group)
        if inventory:
            targets.append(inventory)
        elif group in settings.OIDC_GROUP_INVENTORIES:
            # The mapping names an inventory that does not exist (yet). The inventory still bound
            # to the group keeps its members until the mapping is fixed, so a typo removes nobody.
            unresolved.add(group)
    user.inventories.add(*targets)
    target_ids = {inventory.pk for inventory in targets}
    stale = [
        inventory
        for inventory in user.inventories.filter(oidc_group__isnull=False)
        if inventory.oidc_managed and inventory.pk not in target_ids and inventory.oidc_group not in unresolved
    ]
    user.inventories.remove(*stale)


def bind_inventory(group):
    """Return the inventory the group binds, or None if the group binds none."""
    if len(group) > GROUP_MAX_LENGTH:
        logger.warning("OIDC group name longer than %s characters is ignored: %r", GROUP_MAX_LENGTH, group)
        return None
    if group in settings.OIDC_GROUP_INVENTORIES:
        return bind_mapped_inventory(group, settings.OIDC_GROUP_INVENTORIES[group])
    if is_prefix_group(group):
        # The unique oidc_group makes parallel first logins of two group members safe.
        inventory, _ = Inventory.objects.get_or_create(
            oidc_group=group,
            defaults={"name": group[len(settings.OIDC_INVENTORY_GROUP_PREFIX):][:INVENTORY_NAME_MAX_LENGTH]},
        )
        return inventory
    return None


def bind_mapped_inventory(group, inventory_uuid):
    inventory = Inventory.objects.filter(uuid=inventory_uuid).first()
    if inventory is None:
        logger.warning("OIDC_GROUP_INVENTORIES maps group %r to unknown inventory %s.", group, inventory_uuid)
        return None
    if inventory.oidc_group != group:
        # The mapping wins: an inventory bound to the group before (e.g. through the prefix)
        # becomes a normal inventory and keeps its members.
        Inventory.objects.filter(oidc_group=group).update(oidc_group=None)
        inventory.oidc_group = group
        inventory.save(update_fields=["oidc_group"])
    return inventory
