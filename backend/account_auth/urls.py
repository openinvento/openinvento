from django.urls import path

from .views import (
    CredentialResetView,
    GetCSRFTokenView,
    LoginView,
    LogoutView,
    MeView,
    NotificationDetailView,
    NotificationListView,
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
    path('notifications/', NotificationListView.as_view(), name='notifications'),
    path('notifications/<uuid:notification_uuid>/', NotificationDetailView.as_view(), name='notification-detail'),
    path('credentials/reset/', CredentialResetView.as_view(), name='credentials-reset'),
    path('users/', UserListView.as_view(), name='users'),
    path('users/<uuid:user_uuid>/', UserDetailView.as_view(), name='user-detail'),
]
