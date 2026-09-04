
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf.urls.static import static
from django.conf import settings

from backend.inventory import urls as inventory_api_urls
from backend.account_auth import api_urls as auth_api_urls
from .views import protected_media_view
from .settings import DEBUG

urlpatterns = [
    path('admin/', admin.site.urls),
    
    path("api/", include(inventory_api_urls)),
    path("api/", include(auth_api_urls)),
]

if not DEBUG: #protecteed media view for production with nginx
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', protected_media_view, name='media'),
    ]


if DEBUG: #for dev SERVER
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
