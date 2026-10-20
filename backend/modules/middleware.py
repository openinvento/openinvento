from django.http import JsonResponse

from modules.registry import get_available_modules


class EnabledModuleMiddleware:
    """Hide API routes for optional modules disabled in instance settings."""

    def __init__(self, get_response):
        self.get_response = get_response
        self.prefixes = tuple(
            (f"/api/{module.url_prefix}", module.name)
            for module in get_available_modules()
            if module.url_prefix
        )

    def __call__(self, request):
        for prefix, name in self.prefixes:
            if request.path.startswith(prefix):
                from account_auth.models import InstanceSettings

                if name not in InstanceSettings.get_solo().enabled_modules:
                    return JsonResponse({"detail": "Not found."}, status=404)
                break
        return self.get_response(request)
