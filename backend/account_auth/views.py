import json

from django.contrib.auth import authenticate, login, logout
from django.http.response import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.views.decorators.http import require_POST


def ratelimited_error(request, exception):
    # or other types:
    return JsonResponse({'error': 'ratelimited'}, status=429)


@ensure_csrf_cookie  
def get_csrf_token(request):
    """Set the csrf token in the cookie."""
    return JsonResponse({'detail': 'CSRF cookie set'})

@require_POST
def api_login(request):
    """ Authenticates the user and creates a session. Expects JSON with 'username' and 'password'. """
    try:
        data = json.loads(request.body)
        username = data.get('username')
        password = data.get('password')
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)

    user = authenticate(request, username=username, password=password)
    
    if user is not None:
        login(request, user)
        return JsonResponse({'detail': 'Successfully logged in', 'username': user.username})
    else:
        return JsonResponse({'error': 'Invalid credentials'}, status=401)

@require_POST
def api_logout(request):
    """ Logs out the user and clears the session. """
    logout(request)
    return JsonResponse({'detail': 'Successfully logged out'})
