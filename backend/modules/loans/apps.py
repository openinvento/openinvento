from django.apps import AppConfig


class LoansConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "modules.loans"
    label = "loans"
    verbose_name = "Loans"
    url_prefix = "loans/"
