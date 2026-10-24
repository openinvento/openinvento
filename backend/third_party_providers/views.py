from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from account_auth.authentication import StandardOrAPIKeyAuthMixin
from inventory.permissions import IsInventoryMember

from .models import ThirdPartyProvider
from .serializers import ThirdPartyProviderSerializer


class ThirdPartyProviderViewSet(StandardOrAPIKeyAuthMixin, viewsets.ModelViewSet):
    serializer_class = ThirdPartyProviderSerializer
    permission_classes = (IsAuthenticated, IsInventoryMember)
    http_method_names = ("get", "post", "patch", "delete", "head", "options")

    def get_queryset(self):
        queryset = ThirdPartyProvider.objects.filter(inventory__in=self.request.user.inventories.all())
        inventory_uuid = self.request.query_params.get("inventory")
        return queryset.filter(inventory__uuid=inventory_uuid) if inventory_uuid else queryset
