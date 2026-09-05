from operator import add

from django.urls import path

from .views import *

urlpatterns = [
    path('login/', api_login, name='login'),
    path('logout/', api_logout, name='logout'),
    path('csrf/', get_csrf_token, name='get_csrf_token'),
]
