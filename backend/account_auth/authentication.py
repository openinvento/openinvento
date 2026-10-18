from rest_framework import exceptions
from rest_framework.authentication import BaseAuthentication

from .models import UserAPIKey

# Additional authentication classes can be added here in the future if needed.

# Session Auth is already handled by Django's built-in authentication system

# API key auth
class UserAPIKeyAuthentication(BaseAuthentication):
    """Authenticate ``Authorization: Api-Key <key>`` as its owning user."""

    keyword = b"api-key"

    def authenticate(self, request):
        auth = request.META.get("HTTP_AUTHORIZATION", "").split()
        if not auth or auth[0].lower().encode() != self.keyword:
            return None
        if len(auth) != 2:
            raise exceptions.AuthenticationFailed("Invalid API key header.")

        try:
            key = UserAPIKey.objects.get_from_key(auth[1]) # Fetch the API key from the database
        except UserAPIKey.DoesNotExist:
            raise exceptions.AuthenticationFailed("Invalid, revoked, or expired API key.")
        if key.has_expired:
            raise exceptions.AuthenticationFailed("Invalid, revoked, or expired API key.")

        return (key.user, key)

    def authenticate_header(self, request):
        return "Api-Key"
