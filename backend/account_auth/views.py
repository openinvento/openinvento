from django.contrib.auth import authenticate, login, logout
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CustomUser
from .serializers import SignupSerializer, UserSerializer


class SignupView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
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


class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response({'detail': 'Successfully logged out'})

class GetCSRFTokenView(APIView):
    permission_classes = [permissions.AllowAny]

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        """Setzt den 'csrftoken' Cookie im Browser."""
        return Response({'detail': 'CSRF cookie set'})

class MeView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({'authenticated': False, 'user': None})
        
        return Response({
            'authenticated': True,
            'user': UserSerializer(request.user).data
        })