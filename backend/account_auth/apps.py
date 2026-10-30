from django.apps import AppConfig


class account_authConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'account_auth'

    def ready(self):
        from django.conf import settings

        from .oidc import logger, sign_algo_supported

        # oidc_enabled() turns OIDC off for an unusable signing setup; say so once instead of failing silently.
        if settings.OIDC_ENABLED and not sign_algo_supported():
            logger.error(
                "OIDC login is disabled: OIDC_SIGN_ALGO %r is not supported (RS256/384/512, ES256/384/512, "
                "or HS256/384/512 with a client secret of at least 32 characters).",
                settings.OIDC_RP_SIGN_ALGO,
            )
