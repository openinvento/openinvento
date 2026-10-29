"""OpenID Connect login on top of mozilla-django-oidc.

The library is extended with:
- provider discovery (OpenID Connect Discovery 1.0) unless endpoints are set explicitly,
- issuer, audience and azp checks of the ID token (OpenID Connect Core 1.0, section 3.1.3.7),
- user lookup by issuer + subject instead of the email address,
- a redirect URI built from APP_URL, so it stays correct behind a TLS-terminating proxy.
"""

import logging
import re

import jwt
import requests
from django.conf import settings
from django.contrib.auth.decorators import login_not_required
from django.core.cache import cache
from django.core.exceptions import SuspiciousOperation
from django.db import transaction
from django.http import Http404, HttpResponseRedirect
from django.urls import reverse
from django.utils.decorators import method_decorator
from mozilla_django_oidc.auth import OIDCAuthenticationBackend
from mozilla_django_oidc.views import (
    OIDCAuthenticationCallbackView,
    OIDCAuthenticationRequestView,
)

from .models import CustomUser, OIDCIdentity
from .services import create_user_inventory

logger = logging.getLogger(__name__)

LOGIN_SUCCESS_URL = "/app"
LOGIN_FAILURE_URL = "/auth/login?error=sso"
DISCOVERY_CACHE_SECONDS = 60 * 60

# Maps the mozilla-django-oidc endpoint settings to the keys of the discovery document.
ENDPOINT_SETTINGS = {
    "OIDC_OP_AUTHORIZATION_ENDPOINT": "authorization_endpoint",
    "OIDC_OP_TOKEN_ENDPOINT": "token_endpoint",
    "OIDC_OP_USER_ENDPOINT": "userinfo_endpoint",
    "OIDC_OP_JWKS_ENDPOINT": "jwks_uri",
}

INVALID_USERNAME_CHARACTERS = re.compile(r"[^\w.@+-]")
NAME_MAX_LENGTH = CustomUser._meta.get_field("name").max_length

# Errors that end a login attempt with a redirect to the login page instead of a server error.
LOGIN_ERRORS = (SuspiciousOperation, requests.RequestException, jwt.PyJWTError, ValueError, KeyError)


class OIDCConfigurationError(ValueError):
    pass


def oidc_enabled():
    return bool(settings.OIDC_ENABLED and settings.OIDC_ISSUER and settings.OIDC_RP_CLIENT_ID)


def local_login_allowed(username):
    if not settings.DISABLE_LOCAL_LOGIN:
        return True
    allowed = {name.lower() for name in settings.LOCAL_LOGIN_USERS}
    return bool(username) and username.lower() in allowed


def changes_break_glass_username(old_username, new_username):
    """Whether a rename would move a LOCAL_LOGIN_USERS name to or from an account.

    Renaming away would lock the break-glass account out (the initial admin is asked for
    new credentials on first login); renaming to it would grant password login to another account.
    """
    if not settings.DISABLE_LOCAL_LOGIN or old_username.lower() == new_username.lower():
        return False
    return local_login_allowed(old_username) or local_login_allowed(new_username)


def get_callback_url(request):
    path = reverse("oidc_authentication_callback")
    if settings.APP_URL:
        return settings.APP_URL + path
    return request.build_absolute_uri(path)


def get_provider_metadata():
    issuer = settings.OIDC_ISSUER
    cache_key = f"oidc-provider-metadata:{issuer}"
    metadata = cache.get(cache_key)
    if metadata is None:
        response = requests.get(
            f"{issuer.rstrip('/')}/.well-known/openid-configuration",
            timeout=settings.OIDC_TIMEOUT,
        )
        response.raise_for_status()
        metadata = response.json()
        # OpenID Connect Discovery 1.0, section 4.3: the issuer must match exactly.
        if metadata.get("issuer") != issuer:
            raise OIDCConfigurationError(
                f"Discovery document issuer {metadata.get('issuer')!r} does not match OIDC_ISSUER {issuer!r}."
            )
        cache.set(cache_key, metadata, DISCOVERY_CACHE_SECONDS)
    return metadata


def get_endpoints():
    """Return the provider endpoints, preferring explicitly configured ones over discovery."""
    endpoints = {name: getattr(settings, name, "") for name in ENDPOINT_SETTINGS}
    if not all(endpoints.values()):
        metadata = get_provider_metadata()
        for name, key in ENDPOINT_SETTINGS.items():
            endpoints[name] = endpoints[name] or metadata.get(key, "")
    missing = [name for name, value in endpoints.items() if not value]
    if missing:
        raise OIDCConfigurationError(f"Missing OIDC endpoints: {', '.join(missing)}")
    return endpoints


class OIDCBackend(OIDCAuthenticationBackend):
    def __init__(self, *args, **kwargs):
        # The base class reads the endpoints here and requires a JWKS endpoint for RS256.
        # They are resolved per login instead (from discovery if needed), so password
        # logins, which also run through this backend, never contact the provider.
        self.UserModel = CustomUser

    def authenticate(self, request, **kwargs):
        # Only the callback view passes a nonce; everything else is a password login.
        if request is None or "nonce" not in kwargs or not oidc_enabled():
            return None
        endpoints = get_endpoints()
        self.OIDC_OP_TOKEN_ENDPOINT = endpoints["OIDC_OP_TOKEN_ENDPOINT"]
        self.OIDC_OP_USER_ENDPOINT = endpoints["OIDC_OP_USER_ENDPOINT"]
        self.OIDC_OP_JWKS_ENDPOINT = endpoints["OIDC_OP_JWKS_ENDPOINT"]
        self.OIDC_RP_CLIENT_ID = settings.OIDC_RP_CLIENT_ID
        self.OIDC_RP_CLIENT_SECRET = settings.OIDC_RP_CLIENT_SECRET
        self.OIDC_RP_SIGN_ALGO = settings.OIDC_RP_SIGN_ALGO
        self.OIDC_RP_IDP_SIGN_KEY = None
        return super().authenticate(request, **kwargs)

    def get_token(self, payload):
        payload["redirect_uri"] = get_callback_url(self.request)
        if not payload.get("client_secret"):
            # Public clients authenticate with PKCE only.
            payload.pop("client_secret", None)
        return super().get_token(payload)

    def validate_id_token_claims(self, payload):
        """Check the claims mozilla-django-oidc leaves unchecked (it only verifies signature, exp and nonce)."""
        client_id = settings.OIDC_RP_CLIENT_ID
        if payload.get("iss") != settings.OIDC_ISSUER:
            raise SuspiciousOperation("ID token issuer does not match OIDC_ISSUER.")
        audiences = payload.get("aud")
        if not isinstance(audiences, list):
            audiences = [audiences]
        if client_id not in audiences:
            raise SuspiciousOperation("ID token audience does not contain the client ID.")
        azp = payload.get("azp")
        if (len(audiences) > 1 and not azp) or (azp and azp != client_id):
            raise SuspiciousOperation("ID token azp does not match the client ID.")
        if not payload.get("sub") or "exp" not in payload:
            raise SuspiciousOperation("ID token is missing sub or exp.")

    def get_or_create_user(self, access_token, id_token, payload):
        self.validate_id_token_claims(payload)
        userinfo = self.get_userinfo(access_token, id_token, payload)
        # OpenID Connect Core 1.0, section 5.3.2: the UserInfo sub must match the ID token.
        if userinfo.get("sub") != payload["sub"]:
            raise SuspiciousOperation("UserInfo subject does not match the ID token.")
        claims = {**payload, **userinfo}
        issuer, subject = settings.OIDC_ISSUER, payload["sub"]

        with transaction.atomic():
            identity = OIDCIdentity.objects.select_related("user").filter(issuer=issuer, subject=subject).first()
            if identity:
                return self.update_user(identity.user, claims)

            user = self.find_user_by_verified_email(claims)
            if user is None:
                if not settings.OIDC_CREATE_USERS:
                    logger.info("OIDC login rejected: no account for subject %s and OIDC_CREATE_USERS is off.", subject)
                    return None
                user = self.create_user(claims)
            OIDCIdentity.objects.create(user=user, issuer=issuer, subject=subject)
            return self.update_user(user, claims)

    def find_user_by_verified_email(self, claims):
        if not settings.OIDC_LINK_EXISTING_BY_EMAIL:
            return None
        email = claims.get(settings.OIDC_EMAIL_CLAIM)
        if not email or claims.get("email_verified") not in (True, "true"):
            return None
        # Never move an account that is already linked to another identity.
        users = list(CustomUser.objects.filter(email__iexact=email, oidc_identities__isnull=True)[:2])
        return users[0] if len(users) == 1 else None

    def get_username(self, claims):
        """Return an unused username from the username claim, the email local part or "user"."""
        max_length = CustomUser._meta.get_field("username").max_length
        email = claims.get(settings.OIDC_EMAIL_CLAIM) or ""
        base = str(claims.get(settings.OIDC_USERNAME_CLAIM) or email.split("@")[0])
        base = INVALID_USERNAME_CHARACTERS.sub("_", base)[: max_length - 6] or "user"
        username, suffix = base, 2
        # A taken username never links accounts; it only gets a suffix.
        while CustomUser.objects.filter(username__iexact=username).exists():
            username, suffix = f"{base}_{suffix}", suffix + 1
        return username

    def create_user(self, claims):
        username = self.get_username(claims)
        user = CustomUser(username=username, name=username[:NAME_MAX_LENGTH], email=None)
        # Accounts from the provider have no local password (break-glass accounts stay local).
        user.set_unusable_password()
        user.save()
        create_user_inventory(user)
        return user

    def update_user(self, user, claims):
        """Take name and email from the provider on every login; the username is only set on creation."""
        update_fields = []
        name = str(claims.get(settings.OIDC_NAME_CLAIM) or "").strip()[:NAME_MAX_LENGTH]
        if name and name != user.name:
            user.name = name
            update_fields.append("name")

        email = CustomUser.objects.normalize_email(claims.get(settings.OIDC_EMAIL_CLAIM))
        if email and email != user.email:
            if CustomUser.objects.filter(email__iexact=email).exclude(pk=user.pk).exists():
                logger.warning("OIDC email address of user %s is already used by another account; not updated.", user.pk)
            else:
                user.email = email
                update_fields.append("email")

        if update_fields:
            user.save(update_fields=update_fields)
        return user


@method_decorator(login_not_required, name="dispatch")
class OIDCLoginView(OIDCAuthenticationRequestView):
    def get(self, request):
        if not oidc_enabled():
            raise Http404
        try:
            self.OIDC_OP_AUTH_ENDPOINT = get_endpoints()["OIDC_OP_AUTHORIZATION_ENDPOINT"]
        except LOGIN_ERRORS as exc:
            logger.warning("OIDC provider discovery failed: %s", exc)
            return HttpResponseRedirect(LOGIN_FAILURE_URL)
        self.OIDC_RP_CLIENT_ID = settings.OIDC_RP_CLIENT_ID
        return super().get(request)

    def get_extra_params(self, request):
        # Applied after the base class sets redirect_uri from the request.
        return {**super().get_extra_params(request), "redirect_uri": get_callback_url(request)}


@method_decorator(login_not_required, name="dispatch")
class OIDCCallbackView(OIDCAuthenticationCallbackView):
    @property
    def failure_url(self):
        return LOGIN_FAILURE_URL

    @property
    def success_url(self):
        # The next URL was validated by the login view before it was stored.
        return self.request.session.get("oidc_login_next") or LOGIN_SUCCESS_URL

    def get(self, request):
        if not oidc_enabled():
            raise Http404
        try:
            return super().get(request)
        except LOGIN_ERRORS as exc:
            logger.warning("OIDC login failed: %s", exc)
            return self.login_failure()
