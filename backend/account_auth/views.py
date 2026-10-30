import os
from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as package_version

from django.conf import settings
from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from inventory.serializers import InventorySerializer
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CustomUser, InstanceSettings, Notification, UserAPIKey
from .oidc import local_login_allowed, oidc_enabled
from .serializers import (
    AdminUserSerializer,
    CredentialResetSerializer,
    NotificationSerializer,
    SignupSerializer,
    UserSerializer,
)


class SignupView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        if not settings.ENABLE_SIGNUP or settings.DISABLE_LOCAL_LOGIN:
            # When public signup is disabled, return a 403 Forbidden response with an appropriate error message.
            return Response(
                {'error': 'Public signup is disabled for this instance'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = SignupSerializer(data=request.data)
        if serializer.is_valid():
            # The serializer will create the user and assign an inventory - When a user is invited to an existing inventory, the inventory can be deleted later when the user accepts the invitation
            user = serializer.save()
            # Required since the OIDC backend is installed next to the model backend.
            login(request, user, backend='django.contrib.auth.backends.ModelBackend')
            return Response(
                {
                    'detail': 'Account created successfully',
                    'user': UserSerializer(user).data
                },
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        identifier = request.data.get('identifier') or request.data.get('username') or request.data.get('email')
        password = request.data.get('password')

        if not identifier or not password:
            return Response({'error': 'Missing credentials'}, status=status.HTTP_400_BAD_REQUEST)

        if '@' in identifier and not InstanceSettings.get_solo().allow_email_login:
            return Response(
                {'error': 'Email login is disabled for this instance'},
                status=status.HTTP_403_FORBIDDEN,
            )

        username = identifier
        if '@' in identifier:
            user_obj = CustomUser.objects.filter(email__iexact=identifier).first()
            if user_obj:
                username = user_obj.username

        # Checked before the password, so the response does not reveal whether it was correct.
        if not local_login_allowed(username):
            return Response(
                {'error': 'Local login is disabled for this instance'},
                status=status.HTTP_403_FORBIDDEN,
            )

        user = authenticate(request, username=username, password=password)
        if user:
            login(request, user)
            return Response({
                'detail': 'Successfully logged in',
                'user': UserSerializer(user).data
            })
        
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


class OIDCConfigView(APIView):
    """Public login page settings for single sign-on."""
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        enabled = oidc_enabled()
        return Response({
            'enabled': enabled,
            'button_label': settings.OIDC_BUTTON_LABEL,
            'auto_redirect': enabled and settings.OIDC_AUTO_REDIRECT,
            'local_login_enabled': not settings.DISABLE_LOCAL_LOGIN,
        })


class CredentialResetView(APIView):
    def post(self, request):
        serializer = CredentialResetSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            user = serializer.save()
            update_session_auth_hash(request, user)
            return Response({
                'detail': 'Credentials updated successfully',
                'user': UserSerializer(user).data,
            })
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserListView(APIView):
    """Listing and creating users (User management for instance admins)"""
    permission_classes = (permissions.IsAdminUser,)

    def get(self, request):
        users = CustomUser.objects.order_by('name', 'username')
        return Response(AdminUserSerializer(users, many=True).data)

    @transaction.atomic
    def post(self, request):
        serializer = AdminUserSerializer(data=request.data)
        if serializer.is_valid():
            return Response(AdminUserSerializer(serializer.save()).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# high security relevance: These settings apply for the whole instance (not specific inventories)

class UserDetailView(APIView):
    """Retrieve, update, or delete a user (User management for instance admins)"""
    permission_classes = (permissions.IsAdminUser,)

    def patch(self, request, user_uuid):
        user = get_object_or_404(CustomUser, uuid=user_uuid)
        if user == request.user and request.data.get('is_superuser') is False:
            return Response({'error': 'You cannot remove your own administrator access.'}, status=status.HTTP_400_BAD_REQUEST)
        if user.is_superuser and request.data.get('is_superuser') is False and not CustomUser.objects.filter(is_superuser=True).exclude(pk=user.pk).exists():
            return Response({'error': 'The instance must keep at least one administrator.'}, status=status.HTTP_400_BAD_REQUEST)
        serializer = AdminUserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            return Response(AdminUserSerializer(serializer.save()).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @transaction.atomic
    def delete(self, request, user_uuid):
        user = get_object_or_404(CustomUser, uuid=user_uuid)
        if user == request.user:
            return Response({'error': 'You cannot delete your own account.'}, status=status.HTTP_400_BAD_REQUEST)
        if user.is_superuser and not CustomUser.objects.filter(is_superuser=True).exclude(pk=user.pk).exists():
            return Response({'error': 'The instance must keep at least one administrator.'}, status=status.HTTP_400_BAD_REQUEST)
        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response({'detail': 'Successfully logged out'})

class GetCSRFTokenView(APIView):
    permission_classes = (permissions.AllowAny,)

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        """Setzt den 'csrftoken' Cookie im Browser."""
        return Response({'detail': 'CSRF cookie set'})

class MeView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({'authenticated': False, 'user': None})
        
        return Response({
            'authenticated': True,
            'user': UserSerializer(request.user).data
        })


class SidebarView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        app_version = os.environ.get('APP_VERSION')
        if not app_version:
            try:
                app_version = package_version('openinvento')
            except PackageNotFoundError:
                app_version = '0.1.0'

        inventories = request.user.inventories.all().order_by('name')
        return Response({
            'user': {'name': request.user.name},
            'inventories': InventorySerializer(inventories, many=True).data,
            'version': app_version,
        })


class NotificationListView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        notifications = Notification.objects.filter(user=request.user, read=False)
        return Response(NotificationSerializer(notifications, many=True).data)


class NotificationDetailView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def patch(self, request, notification_uuid):
        notification = get_object_or_404(
            Notification,
            uuid=notification_uuid,
            user=request.user,
        )
        if request.data.get("read") is not True:
            return Response({"read": "Set read to true to dismiss this notification."}, status=status.HTTP_400_BAD_REQUEST)
        notification.read = True
        notification.save(update_fields=("read",))
        return Response(NotificationSerializer(notification).data)


class APIKeyListView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    @staticmethod
    def serialize(key):
        return {
            # The package primary key contains the stored hash; expose only the public prefix.
            "id": key.prefix, # Prefix is used for the URL and is unique, so it can serve as an identifier for the API key
            "name": key.name,
            "prefix": key.prefix,
            "created": key.created,
            "expiry_date": key.expiry_date,
            "revoked": key.revoked,
        }

    def get(self, request):
        keys = UserAPIKey.objects.filter(user=request.user).order_by("-created")
        return Response([self.serialize(key) for key in keys])

    def post(self, request):
        name = str(request.data.get("name", "")).strip()
        if not name:
            return Response({"name": "A name is required."}, status=status.HTTP_400_BAD_REQUEST)
        if len(name) > 50:
            return Response({"name": "Name must be 50 characters or fewer."}, status=status.HTTP_400_BAD_REQUEST)
        api_key, key = UserAPIKey.objects.create_key(name=name, user=request.user)
        return Response({**self.serialize(api_key), "key": key}, status=status.HTTP_201_CREATED)


class APIKeyDetailView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get_key(self, request, key_id):
        return get_object_or_404(UserAPIKey, prefix=key_id, user=request.user)

    def patch(self, request, key_id):
        """ Update the name of an existing API key."""
        api_key = self.get_key(request, key_id)
        name = str(request.data.get("name", "")).strip()
        if not name or len(name) > 50:
            return Response({"name": "Name must contain 1 to 50 characters."}, status=status.HTTP_400_BAD_REQUEST)
        api_key.name = name
        api_key.save(update_fields=("name",))
        return Response(APIKeyListView.serialize(api_key))

    def delete(self, request, key_id):
        """ Revoke an existing API key."""
        api_key = self.get_key(request, key_id)
        api_key.revoked = True
        api_key.save(update_fields=("revoked",))
        return Response(status=status.HTTP_204_NO_CONTENT)
