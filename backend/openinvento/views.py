import os
import tempfile
import zipfile
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404, JsonResponse
from inventory.models import Article, ArticleAttachment
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.views import APIView

#TODO: Add option to serve user uploads through Nginx or a connected S3 storage bucket

def health_view(request):
    """Return HTTP 200 for health checks."""
    return JsonResponse({'status': 'healthy'}, status=200)


# General Endpoints for instance settings

# Attention: This endpoint return the whole data directory
class InstanceBackupView(APIView):
    """Download a ZIP archive of the complete instance data directory."""
    permission_classes = (IsAdminUser,)

    def get(self, request):
        data_dir = os.path.realpath(settings.DATA_DIR)
        archive_file = tempfile.TemporaryFile()
        with zipfile.ZipFile(archive_file, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for root, directories, filenames in os.walk(data_dir, followlinks=False):
                directories[:] = [name for name in directories if not os.path.islink(os.path.join(root, name))]
                for filename in filenames:
                    source_path = os.path.join(root, filename)
                    if os.path.islink(source_path):
                        continue
                    archive.write(source_path, os.path.relpath(source_path, data_dir))

        archive_file.seek(0)
        response = FileResponse(archive_file, content_type="application/zip")
        response["Content-Disposition"] = 'attachment; filename="openinvento-instance-backup.zip"'
        return response

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def protected_media_view(request, path):
    """ Serve protected media files only to authenticated users who have access to the related inventory or article."""
    media_root = Path(settings.MEDIA_ROOT).resolve()
    file_path = (media_root / path).resolve()
    if media_root not in file_path.parents or not file_path.is_file():
        raise Http404("File not found")

    accessible_inventories = (
        Article.objects.filter(inventory__users=request.user)
        if not request.user.is_superuser
        else Article.objects.all()
    )
    if not accessible_inventories.filter(image=path).exists() and not ArticleAttachment.objects.filter(
        file=path, article__in=accessible_inventories
    ).exists():
        raise Http404("File not found")

    attachment = ArticleAttachment.objects.filter(file=path, article__in=accessible_inventories).first()
    filename = attachment.original_name if attachment else file_path.name
    response = FileResponse(file_path.open("rb"), as_attachment=attachment is not None, filename=filename)
    response["Content-Disposition"] = f'attachment; filename="{filename}"' if attachment else f'inline; filename="{filename}"'
    if settings.DEBUG:
        response["Cache-Control"] = "no-store"
    return response
