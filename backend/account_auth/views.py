from django.shortcuts import render, redirect
from django.http.response import JsonResponse
from allauth.account.models import EmailConfirmationHMAC

def ratelimited_error(request, exception):
    # or other types:
    return JsonResponse({'error': 'ratelimited'}, status=429)

