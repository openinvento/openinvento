
from account_auth import urls as auth_urls
from django.contrib import admin
from django.urls import include, path, re_path
from inventory import urls as inventory_api_urls

from .views import health_view, protected_media_view

urlpatterns = [
    path("api/health", health_view, name="health"),
    path('admin/', admin.site.urls),
    
    path("api/", include(inventory_api_urls)),
    path("api/", include(auth_urls)),
]

urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', protected_media_view, name='media'),
]
