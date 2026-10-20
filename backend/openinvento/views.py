import os
import tempfile
import zipfile
import logging
from pathlib import Path

from django.conf import settings
from django.http import FileResponse, Http404, JsonResponse
from account_auth.models import InstanceSettings
from account_auth.serializers import InstanceSettingsSerializer
from inventory.models import Article, ArticleAttachment
from rest_framework import permissions, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAdminUser, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .instance_notifications import get_current_version
from .version_fetching import VersionFetcher
from modules.registry import get_enabled_modules

#TODO: Add option to serve user uploads through Nginx or a connected S3 storage bucket

def health_view(request):
    """Return HTTP 200 for health checks."""
    return JsonResponse({'status': 'healthy'}, status=200)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def modules_view(request):
    """Return the optional modules enabled on this instance."""
    return Response({"modules": [module.name for module in get_enabled_modules()]})


# General Endpoints for instance settings

logger = logging.getLogger(__name__)


class VersionCheckView(APIView):
    """Check for the latest release of OpenInvento and notify instance admins if a newer version is available."""
    permission_classes = (IsAuthenticated,)

    def get(self, request):
        if not request.user.is_superuser:
            return Response({"detail": "Administrator access is required."}, status=status.HTTP_403_FORBIDDEN)

        current_version = get_current_version()
        fetcher = VersionFetcher(current_version=current_version)
        try:
            latest_release = fetcher.fetch_latest_release()
            changelog = fetcher.fetch_changelog_since_version()
        except Exception:
            logger.exception("Could not fetch the OpenInvento release information")
            return Response({"detail": "Could not fetch release information."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)

        return Response({
            "current_version": current_version,
            "newer_version_available": bool(latest_release and latest_release.get("newer_version_available")),
            "latest_release": latest_release,
            "changelog": changelog or [],
        })


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


class InstanceSettingsView(APIView):
    def get(self, request):
        return Response({
            **InstanceSettingsSerializer(InstanceSettings.get_solo()).data,
            "allow_signup": settings.ENABLE_SIGNUP,
        })

    def patch(self, request):
        self.permission_classes = (permissions.IsAdminUser,)
        self.check_permissions(request)
        instance_settings = InstanceSettings.get_solo()
        serializer = InstanceSettingsSerializer(instance_settings, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def protected_media_view(request, path):
    """ Serve protected media files only to authenticated users who have access to the related inventory or article."""
    media_root = Path(settings.MEDIA_ROOT).resolve()
    file_path = (media_root / path).resolve()
    if media_root not in file_path.parents or not file_path.is_file():
        raise Http404("File not found")

    accessible_inventories = Article.objects.filter(inventory__users=request.user)
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
