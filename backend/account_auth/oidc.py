"""OpenID Connect login on top of mozilla-django-oidc.

The library is extended with:
- provider discovery (OpenID Connect Discovery 1.0) unless endpoints are set explicitly,
- issuer, audience and azp checks of the ID token (OpenID Connect Core 1.0, section 3.1.3.7),
- user lookup by issuer + subject instead of the email address,
- allowed groups, admin group and inventory sync from the groups claim (oidc_groups.py),
- a redirect URI built from OIDC_REDIRECT_URI or APP_URL, so it stays correct behind a TLS-terminating proxy,
- a custom CA bundle for providers with a private certificate,
- the hardening listed in the requirement catalog of the pull request: token_type, iss
  response parameter (RFC 9207), state expiry, signing algorithm allow-list, clock skew.
"""

import logging
import os
import re
import time
from urllib.parse import quote_plus, urljoin, urlsplit

import jwt
import requests
from django.conf import settings
from django.contrib.auth.backends import ModelBackend
from django.contrib.auth.decorators import login_not_required
from django.core.cache import cache
from django.core.exceptions import SuspiciousOperation
from django.db import IntegrityError, transaction
from django.http import Http404, HttpResponseRedirect
from django.urls import reverse
from django.utils.decorators import method_decorator
from mozilla_django_oidc.auth import OIDCAuthenticationBackend
from mozilla_django_oidc.views import (
    OIDCAuthenticationCallbackView,
    OIDCAuthenticationRequestView,
)
from requests.auth import HTTPBasicAuth

from .models import CustomUser, OIDCIdentity
from .oidc_groups import apply_group_claims, get_groups, login_allowed
from .services import create_user_inventory

logger = logging.getLogger(__name__)

LOGIN_SUCCESS_URL = "/app"
LOGIN_FAILURE_URL = "/auth/login?error=sso"
DISCOVERY_CACHE_SECONDS = 60 * 60
# Tolerated clock difference to the provider for iat/exp/nbf.
CLOCK_SKEW_SECONDS = 60
# Pending logins (state, nonce, PKCE verifier) expire, which keeps the window for a stolen code short.
STATE_MAX_AGE_SECONDS = 10 * 60
# Only asymmetric algorithms: with HS256/384/512 the client secret is the signing key (OpenID Connect
# Core 1.0, section 10.1), so anyone who reads it from the configuration could issue ID tokens for any
# user. Every OpenID provider must support RS256 (section 15.1).
ASYMMETRIC_SIGN_ALGOS = {"RS256", "RS384", "RS512", "ES256", "ES384", "ES512"}
LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1"}
# Key type (and EC curve) each supported algorithm needs (RFC 7518, sections 3.1 and 6).
KEY_TYPE_FOR_ALGO = {
    "RS256": ("RSA", None), "RS384": ("RSA", None), "RS512": ("RSA", None),
    "ES256": ("EC", "P-256"), "ES384": ("EC", "P-384"), "ES512": ("EC", "P-521"),
}

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


def sign_algo_supported():
    return settings.OIDC_RP_SIGN_ALGO in ASYMMETRIC_SIGN_ALGOS


def tls_settings_problem():
    """Return why the TLS settings for provider requests are unusable, or None."""
    if settings.OIDC_SKIP_SSL_VERIFICATION and settings.OIDC_CA_BUNDLE:
        return "OIDC_SKIP_SSL_VERIFICATION and OIDC_CA_BUNDLE are both set; use only one."
    if settings.OIDC_CA_BUNDLE and not os.path.exists(settings.OIDC_CA_BUNDLE):
        return f"OIDC_CA_BUNDLE {settings.OIDC_CA_BUNDLE!r} does not exist."
    return None


def tls_verify():
    """The verify argument for requests: a CA bundle, the default trust store, or no check at all."""
    if settings.OIDC_SKIP_SSL_VERIFICATION:
        return False
    return settings.OIDC_CA_BUNDLE or True


def oidc_enabled():
    return bool(
        settings.OIDC_ENABLED
        and settings.OIDC_ISSUER
        and settings.OIDC_RP_CLIENT_ID
        and sign_algo_supported()
        and tls_settings_problem() is None
    )


def get_scopes():
    """Return the configured scopes with "openid" first; without it the request is plain OAuth 2.0."""
    scopes = [scope for scope in settings.OIDC_RP_SCOPES.split() if scope != "openid"]
    return " ".join(["openid", *scopes])


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
    if settings.OIDC_REDIRECT_URI:
        return settings.OIDC_REDIRECT_URI
    path = reverse("oidc_authentication_callback")
    if settings.APP_URL:
        return settings.APP_URL + path
    return request.build_absolute_uri(path)


def get_canonical_login_url(request):
    """Return the login URL on the callback host if the login started on another APP_URLS host.

    The state lives in the session cookie of the host the login starts on, so the callback only finds
    it on that host. Hosts outside APP_URL/APP_URLS are left alone: a proxy that rewrites the Host
    header would otherwise be redirected in a loop.
    """
    callback = urlsplit(get_callback_url(request))
    request_host = urlsplit(f"//{request.get_host()}").hostname
    app_hosts = {urlsplit(url).hostname for url in [settings.APP_URL, *settings.APP_URLS] if url}
    if request_host == callback.hostname or request_host not in app_hosts:
        return None
    return f"{callback.scheme}://{callback.netloc}{request.get_full_path()}"


def require_https(url, name):
    """Provider URLs must use TLS (OpenID Connect Core 1.0, section 16.17), except on loopback or when allowed."""
    parsed = urlsplit(url)
    if parsed.scheme == "https" or parsed.hostname in LOOPBACK_HOSTS or settings.OIDC_ALLOW_INSECURE_HTTP:
        return
    raise OIDCConfigurationError(f"{name} must use https (or set OIDC_ALLOW_INSECURE_HTTP): {url}")


def provider_get(url, name, **kwargs):
    """GET from the provider, following redirects only as long as every hop keeps https.

    requests follows redirects to http as well; an attacker on that leg could swap the
    discovery document, the JWKS or the UserInfo claims. requests runs response hooks on
    every redirect before it sends the next request, so the hook rejects an http target
    before anything goes out to it. Redirect limit and Authorization stripping stay with requests.
    """

    def check_redirect_target(response, *args, **kwargs):
        if response.is_redirect:
            require_https(urljoin(response.url, response.headers["location"]), name)

    response = requests.get(
        url,
        verify=tls_verify(),
        timeout=settings.OIDC_TIMEOUT,
        proxies=getattr(settings, "OIDC_PROXY", None),
        hooks={"response": check_redirect_target},
        **kwargs,
    )
    response.raise_for_status()
    return response


def uses_discovery():
    return not all(getattr(settings, name, "") for name in ENDPOINT_SETTINGS)


def get_provider_metadata():
    issuer = settings.OIDC_ISSUER
    cache_key = f"oidc-provider-metadata:{issuer}"
    metadata = cache.get(cache_key)
    if metadata is None:
        metadata = provider_get(f"{issuer.rstrip('/')}/.well-known/openid-configuration", "OIDC discovery").json()
        if not isinstance(metadata, dict):
            raise OIDCConfigurationError("Discovery document must be a JSON object.")
        # OpenID Connect Discovery 1.0, section 4.3: the issuer must match exactly.
        if metadata.get("issuer") != issuer:
            raise OIDCConfigurationError(
                f"Discovery document issuer {metadata.get('issuer')!r} does not match OIDC_ISSUER {issuer!r}."
            )
        cache.set(cache_key, metadata, DISCOVERY_CACHE_SECONDS)
    return metadata


def get_endpoints():
    """Return the provider endpoints, preferring explicitly configured ones over discovery."""
    require_https(settings.OIDC_ISSUER, "OIDC_ISSUER")
    endpoints = {name: getattr(settings, name, "") for name in ENDPOINT_SETTINGS}
    if uses_discovery():
        metadata = get_provider_metadata()
        for name, key in ENDPOINT_SETTINGS.items():
            endpoints[name] = endpoints[name] or metadata.get(key) or ""
        methods = metadata.get("code_challenge_methods_supported")
        # Public clients rely on PKCE alone (RFC 9700, section 2.1.1); a provider that ignores it
        # would let anyone redeem an intercepted code.
        if not settings.OIDC_RP_CLIENT_SECRET and methods is not None and "S256" not in methods:
            raise OIDCConfigurationError("The provider does not support PKCE S256, which public clients require.")
    missing = [name for name, value in endpoints.items() if not value]
    if missing:
        raise OIDCConfigurationError(f"Missing OIDC endpoints: {', '.join(missing)}")
    for name, url in endpoints.items():
        require_https(url, name)
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

    def get_user(self, user_id):
        # The base class returns inactive users too, which would keep their sessions valid.
        return ModelBackend.get_user(self, user_id)

    def get_token(self, payload):
        """Token request; replaces the base class to handle public clients and Basic auth correctly."""
        payload["redirect_uri"] = get_callback_url(self.request)
        secret = payload.pop("client_secret", "")
        auth = None
        # Public clients (no secret) authenticate with PKCE only.
        if secret and settings.OIDC_TOKEN_USE_BASIC_AUTH:
            # RFC 6749, section 2.3.1: form-urlencode client ID and secret before Basic encoding.
            auth = HTTPBasicAuth(quote_plus(payload["client_id"]), quote_plus(secret))
        elif secret:
            payload["client_secret"] = secret
        response = requests.post(
            self.OIDC_OP_TOKEN_ENDPOINT,
            data=payload,
            auth=auth,
            verify=tls_verify(),
            timeout=self.get_settings("OIDC_TIMEOUT", None),
            proxies=self.get_settings("OIDC_PROXY", None),
            # A 307/308 would resend the code, the PKCE verifier and the client secret, possibly over http.
            allow_redirects=False,
        )
        self.raise_token_response_error(response)
        token = response.json()
        # OpenID Connect Core 1.0, section 3.1.3.5, with RFC 6749, section 7.1: only Bearer is supported.
        if str(token.get("token_type", "")).lower() != "bearer":
            raise SuspiciousOperation("Token response has no Bearer token_type.")
        return token

    def _verify_jws(self, payload, key):
        """Like the base class, with clock skew leeway and the algorithm passed as a list (RFC 8725, 3.1)."""
        algo = jwt.get_unverified_header(payload).get("alg")
        if algo != self.OIDC_RP_SIGN_ALGO:
            raise SuspiciousOperation(f"Token algorithm {algo!r} does not match OIDC_SIGN_ALGO.")
        return jwt.decode(
            payload, key, algorithms=[algo], leeway=CLOCK_SKEW_SECONDS, options={"verify_aud": False}
        )

    def retrieve_matching_jwk(self, token):
        """Replaces the base class so the JWKS is fetched with provider_get and tokens without kid work."""
        header = jwt.get_unverified_header(token)
        algo = header.get("alg")
        # Also checked in _verify_jws; checking it before the key lookup names the actual problem
        # when a provider signs with another algorithm (e.g. HS256) instead of "no matching key".
        if algo != self.OIDC_RP_SIGN_ALGO:
            raise SuspiciousOperation(f"Token algorithm {algo!r} does not match OIDC_SIGN_ALGO.")
        jwks = provider_get(self.OIDC_OP_JWKS_ENDPOINT, "OIDC_OP_JWKS_ENDPOINT").json().get("keys", [])
        if "kid" in header:
            # Same selection as the base class: matching kid, and matching alg where the key names one.
            keys = [key for key in jwks if key.get("kid") == header["kid"] and key.get("alg", algo) == algo]
            if not keys:
                raise SuspiciousOperation("Could not find a valid JWKS.")
            return jwt.PyJWK(keys[-1])
        # Providers with a single signing key may omit kid; never guess between several keys.
        kty, crv = KEY_TYPE_FOR_ALGO.get(algo, (None, None))
        keys = [
            key for key in jwks
            if key.get("use", "sig") == "sig"
            and key.get("alg", algo) == algo
            and key.get("kty") == kty
            and (crv is None or key.get("crv") == crv)
        ]
        if len(keys) != 1:
            raise SuspiciousOperation("Token has no kid and the provider has more than one matching key.")
        return jwt.PyJWK(keys[0])

    def get_userinfo(self, access_token, id_token, payload):
        """UserInfo request; replaces the base class so a signed response can be told apart from JSON."""
        response = provider_get(
            self.OIDC_OP_USER_ENDPOINT,
            "OIDC_OP_USER_ENDPOINT",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        # OpenID Connect Core 1.0, section 5.3.2: the response is either JSON or a JWT.
        content_type = response.headers.get("content-type", "").split(";")[0].strip().lower()
        if content_type not in ("application/json", "application/jwt"):
            raise SuspiciousOperation(f"UserInfo response has unexpected content type {content_type!r}.")
        if content_type == "application/jwt":
            userinfo = self.verify_token(response.text)
            # OpenID Connect Core 1.0, section 5.3.2: a signed response must contain iss and aud.
            audiences = userinfo.get("aud")
            if not isinstance(audiences, list):
                audiences = [audiences]
            if userinfo.get("iss") != settings.OIDC_ISSUER or settings.OIDC_RP_CLIENT_ID not in audiences:
                raise SuspiciousOperation("Signed UserInfo response has a missing or unexpected iss or aud.")
        else:
            userinfo = response.json()
        if not isinstance(userinfo, dict):
            raise SuspiciousOperation("UserInfo response is not a JSON object.")
        return userinfo

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
        # Step 3: a token that also names other audiences could be replayed by them, so it is
        # rejected even when azp names us (no other audience is trusted).
        if set(audiences) != {client_id}:
            raise SuspiciousOperation("ID token has untrusted additional audiences.")
        azp = payload.get("azp")
        if azp and azp != client_id:
            raise SuspiciousOperation("ID token azp does not match the client ID.")
        # Section 2: sub, exp and iat are REQUIRED; PyJWT only validates them when present.
        missing = [claim for claim in ("sub", "exp", "iat") if not payload.get(claim)]
        if missing:
            raise SuspiciousOperation(f"ID token is missing required claims: {', '.join(missing)}.")

    def get_or_create_user(self, access_token, id_token, payload):
        self.validate_id_token_claims(payload)
        userinfo = self.get_userinfo(access_token, id_token, payload)
        # OpenID Connect Core 1.0, section 5.3.2: the UserInfo sub must match the ID token.
        if userinfo.get("sub") != payload["sub"]:
            raise SuspiciousOperation("UserInfo subject does not match the ID token.")
        claims = {**payload, **userinfo}
        subject = payload["sub"]
        groups = get_groups(claims)
        if not login_allowed(groups):
            logger.info("OIDC login rejected: subject %s is in none of OIDC_ALLOWED_GROUPS.", subject)
            return None

        with transaction.atomic():
            user = self.get_or_link_user(claims, subject)
            if user is None:
                return None
            self.update_user(user, claims)
            apply_group_claims(user, groups)
            return user

    def get_or_link_user(self, claims, subject):
        """Return the account linked to issuer + subject, linking or creating one on the first login."""
        issuer = settings.OIDC_ISSUER
        identity = OIDCIdentity.objects.select_related("user").filter(issuer=issuer, subject=subject).first()
        if identity:
            return identity.user

        try:
            with transaction.atomic():
                user = self.find_user_by_verified_email(claims)
                if user is None:
                    if not settings.OIDC_CREATE_USERS:
                        logger.info(
                            "OIDC login rejected: no account for subject %s and OIDC_CREATE_USERS is off.", subject
                        )
                        return None
                    user = self.create_user(claims)
                OIDCIdentity.objects.create(user=user, issuer=issuer, subject=subject)
        except IntegrityError:
            # A parallel first login of the same account (e.g. a second tab) linked it first;
            # the account created here is rolled back.
            identity = OIDCIdentity.objects.select_related("user").filter(issuer=issuer, subject=subject).first()
            if identity is None:
                # Another constraint failed, e.g. a parallel first login of a different account
                # took the same username; this attempt fails and the user can retry.
                logger.warning("OIDC login failed: account for subject %s could not be created.", subject)
                return None
            return identity.user
        return user

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
        # With group sync, apply_group_claims creates it only if the user ends up in no inventory.
        if not settings.OIDC_GROUP_SYNC:
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
        # Only an explicit "not verified" is refused: some providers (e.g. Microsoft Entra ID)
        # never send email_verified. Linking accounts by email still requires it to be true.
        if claims.get("email_verified") in (False, "false"):
            email = None
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
    @staticmethod
    def get_settings(attr, *args):
        if attr == "OIDC_RP_SCOPES":
            return get_scopes()
        return OIDCAuthenticationRequestView.get_settings(attr, *args)

    def get(self, request):
        if not oidc_enabled():
            raise Http404
        canonical_url = get_canonical_login_url(request)
        if canonical_url:
            return HttpResponseRedirect(canonical_url)
        try:
            endpoint = get_endpoints()["OIDC_OP_AUTHORIZATION_ENDPOINT"]
        except LOGIN_ERRORS as exc:
            logger.warning("OIDC provider discovery failed: %s", exc)
            return HttpResponseRedirect(LOGIN_FAILURE_URL)
        # The base class appends "?<query>"; keep a query string the endpoint already has.
        self.OIDC_OP_AUTH_ENDPOINT, _, endpoint_query = endpoint.partition("?")
        self.OIDC_RP_CLIENT_ID = settings.OIDC_RP_CLIENT_ID
        response = super().get(request)
        if endpoint_query:
            response["Location"] = response["Location"].replace("?", f"?{endpoint_query}&", 1)
        return response

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
            if not self.has_valid_state(request):
                # Also keeps a forged "?error=..." link from logging the user out.
                return self.login_failure()
            self.check_iss_parameter(request)
            return super().get(request)
        except LOGIN_ERRORS as exc:
            logger.warning("OIDC login failed: %s", exc)
            return self.login_failure()

    def has_valid_state(self, request):
        states = request.session.get("oidc_states")
        if not isinstance(states, dict):
            return False
        oldest = time.time() - STATE_MAX_AGE_SECONDS
        expired = [state for state, entry in states.items() if entry.get("added_on", 0) < oldest]
        for state in expired:
            del states[state]
        if expired:
            request.session.modified = True
        return request.GET.get("state") in states

    def check_iss_parameter(self, request):
        """RFC 9207: the iss response parameter must name our issuer, and is required if advertised."""
        iss = request.GET.get("iss")
        if iss is not None and iss != settings.OIDC_ISSUER:
            raise SuspiciousOperation("Authorization response iss does not match OIDC_ISSUER.")
        advertised = uses_discovery() and get_provider_metadata().get("authorization_response_iss_parameter_supported")
        if iss is None and "code" in request.GET and advertised:
            raise SuspiciousOperation("Authorization response is missing the iss parameter.")
