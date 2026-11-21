from django.urls import path

from .views import PublicContactView, PublicPhotoView, PublicPageView, PublicPageSettingsView

urlpatterns = [
    path("entries/<uuid:entry_uuid>/", PublicPageSettingsView.as_view(), name="publicpage-settings"),
    # Public: the inventory and entry identifiers of the scan URL /i/<inventory>/<identifier>.
    path("scan/<str:inventory>/<str:identifier>/", PublicPageView.as_view(), name="publicpage-view"),
    path("scan/<str:inventory>/<str:identifier>/photo/", PublicPhotoView.as_view(), name="publicpage-photo"),
    path("scan/<str:inventory>/<str:identifier>/contact/", PublicContactView.as_view(), name="publicpage-contact"),
]
