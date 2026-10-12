from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404
from inventory.models import Article
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated

#TODO: Add option to serve user uploads through Nginx or a connected S3 storage bucket

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def protected_media_view(request, path):
    media_root = Path(settings.MEDIA_ROOT).resolve()
    file_path = (media_root / path).resolve()
    if media_root not in file_path.parents or not file_path.is_file():
        raise Http404("File not found")

    accessible_inventories = (
        Article.objects.filter(inventory__users=request.user)
        if not request.user.is_superuser
        else Article.objects.all()
    )
    if not accessible_inventories.filter(image=path).exists():
        raise Http404("File not found")

    response = FileResponse(file_path.open("rb"), as_attachment=False, filename=file_path.name)
    response["Content-Disposition"] = f'inline; filename="{file_path.name}"'
    if settings.DEBUG:
        response["Cache-Control"] = "no-store"
    return response
