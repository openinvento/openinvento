from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    ArticleAttachmentsView,
    ArticleCategoryViewSet,
    BarcodeProductLookupView,
    CategoryFieldViewSet,
    CodeLookupView,
    CodePdfView,
    DashboardView,
    ExportInventoryView,
    InventoryEntryViewSet,
    InventoryManageView,
    InventoryMembersView,
    InventoryViewSet,
    MagicArticleImportView,
    SearchView,
)

router = DefaultRouter()
router.register(r"inventories", InventoryViewSet, basename="inventory")
router.register(r"entries", InventoryEntryViewSet, basename="inventory-entry")
router.register(r"article-categories", ArticleCategoryViewSet, basename="article-category")
router.register(r"category-fields", CategoryFieldViewSet, basename="category-field")

urlpatterns = [
    path("entries/magic-import/", MagicArticleImportView.as_view(), name="magic-article-import"),
    path("article-attachments/", ArticleAttachmentsView.as_view(), name="article-attachments"),
    path("inventories/<uuid:inventory_uuid>/members/", InventoryMembersView.as_view(), name="inventory-members"),
    path("inventories/<uuid:inventory_uuid>/members/<uuid:user_uuid>/", InventoryMembersView.as_view(), name="inventory-member-delete"),
    path("inventories/<uuid:inventory_uuid>/", InventoryManageView.as_view(), name="inventory-manage"),
    path("inventories/<uuid:inventory_uuid>/export/", ExportInventoryView.as_view(), name="inventory-export"),
    path("dashboard/", DashboardView.as_view(), name="dashboard"),
    path("search/", SearchView.as_view(), name="search"),
    path("codes/lookup/", CodeLookupView.as_view(), name="code-lookup"),
    path("barcodes/lookup/", BarcodeProductLookupView.as_view(), name="barcode-product-lookup"),
    path("codes/pdf/", CodePdfView.as_view(), name="code-pdf"),
] + router.urls
