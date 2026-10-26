from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from account_auth.authentication import StandardOrAPIKeyAuthMixin
from inventory.permissions import IsInventoryMember

from .catalog import PROVIDER_CONFIGURATIONS
from .models import ThirdPartyProvider
from .serializers import ThirdPartyProviderSerializer


class ThirdPartyProviderViewSet(StandardOrAPIKeyAuthMixin, viewsets.ModelViewSet):
    serializer_class = ThirdPartyProviderSerializer
    permission_classes = (IsAuthenticated, IsInventoryMember)
    http_method_names = ("get", "post", "patch", "delete", "head", "options")

    @action(detail=False, methods=("get",), url_path="configurations", permission_classes=(IsAuthenticated,))
    def configurations(self, request):
        return Response(PROVIDER_CONFIGURATIONS)

    def get_queryset(self):
        queryset = ThirdPartyProvider.objects.filter(inventory__in=self.request.user.inventories.all())
        inventory_uuid = self.request.query_params.get("inventory")
        return queryset.filter(inventory__uuid=inventory_uuid) if inventory_uuid else queryset
