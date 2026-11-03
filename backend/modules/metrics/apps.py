from django.apps import AppConfig


class MetricsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "modules.metrics"
    label = "metrics"
    verbose_name = "Prometheus metrics"
    url_prefix = "metrics/"
