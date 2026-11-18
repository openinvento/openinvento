from django.apps import AppConfig


class LostFoundConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "modules.lostfound"
    label = "lostfound"
    verbose_name = "Lost and found"
    url_prefix = "lostfound/"
