from rest_framework.routers import DefaultRouter

from .views import ThirdPartyProviderViewSet

router = DefaultRouter()
router.register(r"third-party-providers", ThirdPartyProviderViewSet, basename="third-party-provider")

urlpatterns = router.urls
