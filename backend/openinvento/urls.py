
from account_auth import urls as auth_urls
from django.contrib import admin
from django.urls import include, path, re_path
from modules.registry import get_enabled_modules
from inventory import urls as inventory_api_urls

from .views import InstanceBackupView, InstanceSettingsView, VersionCheckView, health_view, protected_media_view

urlpatterns = [
    path("api/health", health_view, name="health"),
    path("api/instance-settings/backup/", InstanceBackupView.as_view(), name="instance-backup"),
    path("api/instance-settings/version-check/", VersionCheckView.as_view(), name="version-check"),
    path("api/instance-settings/", InstanceSettingsView.as_view(), name="instance-settings"),
    # Deactivate the admin panel for security reasons, maybe activate it later (optionally!)
    #path('admin/', admin.site.urls),
    
    path("api/", include(inventory_api_urls)),
    path("api/", include(auth_urls)),
]

for module in get_enabled_modules():
    if module.urlpatterns is not None:
        urlpatterns.append(
            path(
                f"api/{module.url_prefix}",
                include(module.urlconf),
            )
        )

urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', protected_media_view, name='media'),
]
