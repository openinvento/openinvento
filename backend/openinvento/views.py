from django.contrib.auth.decorators import login_required
from django.http import HttpResponse, Http404, HttpResponseNotAllowed
import os
from .settings import MEDIA_ROOT, MEDIA_URL
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

@api_view(['GET'])
@permission_classes([IsAuthenticated]) #
def protected_media_view(request, path):
    print(f'{"/protected_media/"}{path}')
    file_path = os.path.join(MEDIA_ROOT, path)
    if os.path.exists(file_path):
        response = HttpResponse()
        response['Content-Disposition'] = f'inline; filename={os.path.basename(file_path)}'
        response['X-Accel-Redirect'] = f'{"/protected_media/"}{path}'
        return response
    raise Http404("File not found")
