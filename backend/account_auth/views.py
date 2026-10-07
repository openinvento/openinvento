from django.contrib.auth import authenticate, login, logout, update_session_auth_hash
from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import permissions, status
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CustomUser, InstanceSettings
from .serializers import (
    CredentialResetSerializer,
    InstanceSettingsSerializer,
    SignupSerializer,
    UserSerializer,
    AdminUserSerializer,
)


class SignupView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not settings.ENABLE_SIGNUP:
            # When public signup is disabled, return a 403 Forbidden response with an appropriate error message.
            return Response(
                {'error': 'Public signup is disabled for this instance'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = SignupSerializer(data=request.data)
        if serializer.is_valid():
            # The serializer will create the user and assign an inventory - When a user is invited to an existing inventory, the inventory can be deleted later when the user accepts the invitation
            user = serializer.save()
            login(request, user)
            return Response(
                {
                    'detail': 'Account created successfully',
                    'user': UserSerializer(user).data
                },
                status=status.HTTP_201_CREATED
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

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

        user = authenticate(request, username=username, password=password)
        if user:
            login(request, user)
            return Response({
                'detail': 'Successfully logged in',
                'user': UserSerializer(user).data
            })
        
        return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


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


class InstanceSettingsView(APIView):
    def get(self, request):
        return Response({
            **InstanceSettingsSerializer(InstanceSettings.get_solo()).data,
            'allow_signup': settings.ENABLE_SIGNUP,
        })

    def patch(self, request):
        self.permission_classes = (permissions.IsAdminUser,)
        self.check_permissions(request)
        instance_settings = InstanceSettings.get_solo()
        serializer = InstanceSettingsSerializer(instance_settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
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