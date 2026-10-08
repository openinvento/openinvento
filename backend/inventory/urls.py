from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AreaViewSet,
    ArticleCategoryViewSet,
    ArticleViewSet,
    CategoryFieldViewSet,
    ChestViewSet,
    DashboardView,
    InventoryViewSet,
    InventoryManageView,
    InventoryMembersView,
    SearchView,
    ShelfViewSet,
)

router = DefaultRouter()
router.register(r"inventories", InventoryViewSet, basename="inventory")
router.register(r"areas", AreaViewSet, basename="area")
router.register(r"shelves", ShelfViewSet, basename="shelf")
router.register(r"chests", ChestViewSet, basename="chest")
router.register(r"article-categories", ArticleCategoryViewSet, basename="article-category")
router.register(r"category-fields", CategoryFieldViewSet, basename="category-field")
router.register(r"articles", ArticleViewSet, basename="article")

urlpatterns = [
    path("inventories/<uuid:inventory_uuid>/members/", InventoryMembersView.as_view(), name="inventory-members"),
    path("inventories/<uuid:inventory_uuid>/members/<uuid:user_uuid>/", InventoryMembersView.as_view(), name="inventory-member-delete"),
    path("inventories/<uuid:inventory_uuid>/", InventoryManageView.as_view(), name="inventory-manage"),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("search/", SearchView.as_view(), name="search"),
] + router.urls
