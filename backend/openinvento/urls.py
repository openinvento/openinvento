
from account_auth import urls as auth_urls
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path, re_path
from inventory import urls as inventory_api_urls

from .settings import DEBUG
from .views import protected_media_view

urlpatterns = [
    path('admin/', admin.site.urls),
    
    path("api/", include(inventory_api_urls)),
    path("api/", include(auth_urls)),
]

if not DEBUG: #protecteed media view for production with nginx
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', protected_media_view, name='media'),
    ]


if DEBUG: #for dev SERVER
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
