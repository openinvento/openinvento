from django.urls import path

from .views import (
    CredentialResetView,
    InstanceSettingsView,
    GetCSRFTokenView,
    LoginView,
    LogoutView,
    MeView,
    SignupView,
    SidebarView,
    UserDetailView,
    UserListView,
)

urlpatterns = [
    path('signup/', SignupView.as_view(), name='signup'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('csrf/', GetCSRFTokenView.as_view(), name='csrf-token'),
    path('me/', MeView.as_view(), name='me'),
    path('sidebar/', SidebarView.as_view(), name='sidebar'),
    path('credentials/reset/', CredentialResetView.as_view(), name='credentials-reset'),
    path('instance-settings/', InstanceSettingsView.as_view(), name='instance-settings'),
    path('users/', UserListView.as_view(), name='users'),
    path('users/<uuid:user_uuid>/', UserDetailView.as_view(), name='user-detail'),
]