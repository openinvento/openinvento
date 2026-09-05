from rest_framework import permissions

from .models import Inventory


class IsInventoryMember(permissions.BasePermission):
    message = "You do not have access to this inventory."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if request.user.is_superuser:
            return True

        inventory = obj if isinstance(obj, Inventory) else getattr(obj, "inventory", None)
        if inventory is None:
            return False

        return request.user.inventories.filter(pk=inventory.pk).exists()
