from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Area, Article, ArticleCategory, Chest, Inventory, Shelf
from .permissions import IsInventoryMember
from .serializers import (
    AreaSerializer,
    ArticleCategorySerializer,
    ArticleSerializer,
    ChestSerializer,
    InventorySerializer,
    ShelfSerializer,
)


class InventoryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InventorySerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "head", "options"]

    def get_queryset(self):
        if self.request.user.is_superuser:
            return Inventory.objects.all().order_by("name")
        return Inventory.objects.filter(users=self.request.user).order_by("name")


class InventoryScopedViewSet(viewsets.ModelViewSet):
    """ Base class for viewsets that are scoped to a specific inventory.  (Handle inventory + authentication)"""
    permission_classes = [IsAuthenticated, IsInventoryMember]
    select_related_fields = ("inventory",)
    prefetch_related_fields = ()
    ordering = ("name",)

    def get_accessible_inventories(self):
        if self.request.user.is_superuser:
            return Inventory.objects.all()
        return self.request.user.inventories.all()

    def get_queryset(self):
        queryset = super().get_queryset().filter(inventory__in=self.get_accessible_inventories())
        if self.select_related_fields:
            queryset = queryset.select_related(*self.select_related_fields)
        if self.prefetch_related_fields:
            queryset = queryset.prefetch_related(*self.prefetch_related_fields)
        if self.ordering:
            queryset = queryset.order_by(*self.ordering)
        return queryset


class AreaViewSet(InventoryScopedViewSet):
    queryset = Area.objects.all()
    serializer_class = AreaSerializer


class ShelfViewSet(InventoryScopedViewSet):
    queryset = Shelf.objects.all()
    serializer_class = ShelfSerializer
    select_related_fields = ("inventory", "area")


class ChestViewSet(InventoryScopedViewSet):
    queryset = Chest.objects.all()
    serializer_class = ChestSerializer
    select_related_fields = ("inventory", "area", "shelf", "parent_chest")


class ArticleCategoryViewSet(InventoryScopedViewSet):
    queryset = ArticleCategory.objects.all()
    serializer_class = ArticleCategorySerializer


class ArticleViewSet(InventoryScopedViewSet):
    queryset = Article.objects.all()
    serializer_class = ArticleSerializer
    select_related_fields = ("inventory", "area", "shelf", "chest", "category")
