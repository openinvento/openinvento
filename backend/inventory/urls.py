from django.urls import path
from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import (
    AreaViewSet,
    ArticleCategoryViewSet,
    ArticleViewSet,
    ChestViewSet,
    InventoryViewSet,
    SearchView,
    ShelfViewSet,
)

router = DefaultRouter()
router.register(r"inventories", InventoryViewSet, basename="inventory")
router.register(r"areas", AreaViewSet, basename="area")
router.register(r"shelves", ShelfViewSet, basename="shelf")
router.register(r"chests", ChestViewSet, basename="chest")
router.register(r"article-categories", ArticleCategoryViewSet, basename="article-category")
router.register(r"articles", ArticleViewSet, basename="article")

urlpatterns = router.urls + [
    path("search/", SearchView.as_view(), name="search"),
]
