from django.db.models import Count
from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from account_auth.models import CustomUser
from account_auth.serializers import UserSerializer

from .models import (
    Area,
    Article,
    ArticleCategory,
    CategoryField,
    Chest,
    Inventory,
    Shelf,
)
from .permissions import IsInventoryMember
from .serializers import (
    AreaSerializer,
    ArticleCategorySerializer,
    ArticleSerializer,
    CategoryFieldSerializer,
    ChestSerializer,
    InventorySerializer,
    ShelfSerializer,
)


class InventoryViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = InventorySerializer
    permission_classes = (IsAuthenticated,)
    http_method_names = ("get", "head", "options")

    def get_queryset(self):
        if self.request.user.is_superuser:
            return Inventory.objects.all().order_by("name")
        return Inventory.objects.filter(users=self.request.user).order_by("name")


class InventoryMembersView(APIView):
    """ API view for managing members of a specific inventory."""
    permission_classes = (IsAuthenticated,)

    def get_inventory(self, request, inventory_uuid):
        inventories = Inventory.objects.all() if request.user.is_superuser else request.user.inventories.all()
        return get_object_or_404(inventories, uuid=inventory_uuid)

    def get(self, request, inventory_uuid):
        inventory = self.get_inventory(request, inventory_uuid)
        members = inventory.users.order_by("name", "username")
        available_users = (
            CustomUser.objects.exclude(inventories=inventory).order_by("name", "username")
            if settings.ALLOW_INVENTORY_USER_INVITES
            else CustomUser.objects.none()
        )
        return Response({
            "inventory": InventorySerializer(inventory).data,
            "members": UserSerializer(members, many=True).data,
            "available_users": UserSerializer(available_users, many=True).data,
            "can_invite": settings.ALLOW_INVENTORY_USER_INVITES,
        })

    def post(self, request, inventory_uuid):
        if not settings.ALLOW_INVENTORY_USER_INVITES:
            return Response({"error": "Inventory user invites are disabled."}, status=403)
        inventory = self.get_inventory(request, inventory_uuid)
        user = get_object_or_404(CustomUser, uuid=request.data.get("user_uuid"))
        inventory.users.add(user)
        return Response(UserSerializer(user).data, status=201)

    def delete(self, request, inventory_uuid, user_uuid):
        inventory = self.get_inventory(request, inventory_uuid)
        user = get_object_or_404(CustomUser, uuid=user_uuid)
        inventory.users.remove(user)
        return Response(status=204)


class InventoryDeleteView(InventoryMembersView):
    def delete(self, request, inventory_uuid):
        inventory = self.get_inventory(request, inventory_uuid)
        inventory.delete()
        return Response(status=204)


class InventoryScopedViewSet(viewsets.ModelViewSet):
    """ Base class for viewsets that are scoped to a specific inventory.  (Handle inventory + authentication)"""
    permission_classes = (IsAuthenticated, IsInventoryMember)
    select_related_fields = ("inventory",)
    prefetch_related_fields = ()
    ordering = ("name",)

    def get_accessible_inventories(self):
        if self.request.user.is_superuser:
            return Inventory.objects.all()
        return self.request.user.inventories.all()

    def get_queryset(self):
        queryset = super().get_queryset().filter(inventory__in=self.get_accessible_inventories())
        inventory_uuid = self.request.query_params.get("inventory")
        if inventory_uuid:
            queryset = queryset.filter(inventory__uuid=inventory_uuid)
        
        if self.select_related_fields:
            queryset = queryset.select_related(*self.select_related_fields)
        if self.prefetch_related_fields:
            queryset = queryset.prefetch_related(*self.prefetch_related_fields)
            
        if self.ordering:
            model_fields = {f.name for f in queryset.model._meta.get_fields()}
            
            valid_ordering = []
            for field in self.ordering:
                clean_field = field.lstrip('-')
                
                if clean_field in model_fields:
                    valid_ordering.append(field)
                elif clean_field == "name" and "label" in model_fields:
                    fallback = field.replace("name", "label")
                    valid_ordering.append(fallback)
                elif "id" in model_fields:
                    valid_ordering.append(field.replace(clean_field, "pk"))
            if valid_ordering:
                queryset = queryset.order_by(*valid_ordering)
                
        return queryset


class InventoryScopedAPIView(APIView):
    """ Base class for API views that are scoped to a specific inventory.  (Handle inventory + authentication)"""
    permission_classes = (IsAuthenticated, IsInventoryMember)

    def get_accessible_inventories(self):
        if self.request.user.is_superuser:
            return Inventory.objects.all()
        return self.request.user.inventories.all()


class DashboardView(InventoryScopedAPIView):
    def get(self, request, *args, **kwargs):
        inventories = self.get_accessible_inventories()
        inventory_uuid = request.query_params.get("inventory")
        if inventory_uuid:
            inventories = inventories.filter(uuid=inventory_uuid)
        scoped_models = (
            (Area, "area", "name"),
            (Shelf, "shelf", "name"),
            (Chest, "chest", "name"),
            (Article, "article", "name"),
            (ArticleCategory, "category", "name"),
            (CategoryField, "field", "label"),
        )

        counts = {
            "areas": Area.objects.filter(inventory__in=inventories).count(),
            "articles": Article.objects.filter(inventory__in=inventories).count(),
            "categories": ArticleCategory.objects.filter(inventory__in=inventories).count(),
        }
        category_counts = (
            Article.objects.filter(inventory__in=inventories)
            .values("category__name")
            .annotate(count=Count("uuid"))
            .order_by("-count", "category__name")
        )

        last_added = []
        for model, object_type, name_field in scoped_models:
            fields = {"uuid", name_field, "created_at"}
            for item in model.objects.filter(inventory__in=inventories).values(*fields).order_by("-created_at")[:10]:
                last_added.append({
                    "uuid": str(item["uuid"]),
                    "name": item[name_field],
                    "type": object_type,
                    "created_at": item["created_at"],
                })

        last_added.sort(key=lambda item: item["created_at"], reverse=True)
        return Response({
            "counts": counts,
            "category_counts": [
                {"name": item["category__name"] or "No category", "count": item["count"]}
                for item in category_counts
            ],
            "last_added": last_added[:4],
        })


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


class CategoryFieldViewSet(InventoryScopedViewSet):
    queryset = CategoryField.objects.all()
    serializer_class = CategoryFieldSerializer
    select_related_fields = ("inventory", "category")


class ArticleViewSet(InventoryScopedViewSet):
    queryset = Article.objects.all()
    serializer_class = ArticleSerializer
    select_related_fields = ("inventory", "area", "shelf", "chest", "category")


class SearchView(InventoryScopedAPIView):
    """
    Search for articles in the inventory.
    """
    def get(self, request, *args, **kwargs):
        query = request.query_params.get("q", "")
        if not query:
            return Response({"error": "Query parameter 'q' is required."}, status=400)

        inventory = request.query_params.get("inventory")
        if not inventory:
            return Response({"error": "Query parameter 'inventory' is required."}, status=400)
        articles = Article.objects.filter(
            inventory__in=self.get_accessible_inventories(),
            inventory__uuid=inventory,
            name__icontains=query
        ).select_related("inventory", "area", "shelf", "chest", "category")

        serializer = ArticleSerializer(articles, many=True)
        return Response(serializer.data)