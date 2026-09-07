from django.urls import path

from .views import (
    GetCSRFTokenView,
    LoginView,
    LogoutView,
    MeView,
    SignupView,
)

urlpatterns = [
    path('signup/', SignupView.as_view(), name='signup'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('csrf-token/', GetCSRFTokenView.as_view(), name='csrf-token'),
    path('me/', MeView.as_view(), name='me'),
]