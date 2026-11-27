from django.apps import AppConfig


class PublicPageConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "modules.publicpage"
    label = "publicpage"
    verbose_name = "Public page"
    url_prefix = "publicpage/"
