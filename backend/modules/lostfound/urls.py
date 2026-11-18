from django.urls import path

from .views import FoundContactView, FoundPhotoView, FoundView, LostFoundEntryView

urlpatterns = [
    path("entries/<uuid:entry_uuid>/", LostFoundEntryView.as_view(), name="lostfound-entry"),
    # Public: the inventory and entry identifiers of the scan URL /i/<inventory>/<identifier>.
    path("found/<str:inventory>/<str:identifier>/", FoundView.as_view(), name="lostfound-found"),
    path("found/<str:inventory>/<str:identifier>/photo/", FoundPhotoView.as_view(), name="lostfound-photo"),
    path("found/<str:inventory>/<str:identifier>/contact/", FoundContactView.as_view(), name="lostfound-contact"),
]
