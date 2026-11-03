import http.client
import json
import os
import tempfile
import uuid
from typing import ClassVar
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen
from venv import logger

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Count, Prefetch
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from account_auth.authentication import StandardOrAPIKeyAuthMixin
from account_auth.models import CustomUser
from account_auth.serializers import UserSerializer
from ai_features.object_detection.main import LUCIDE_ARTICLE_ICONS

from .code_utils import generate_codes_pdf
from .export_utils import generate_inventory_csv_export
from .models import (
    ArticleAttachment,
    ArticleCategory,
    CategoryField,
    Inventory,
    InventoryEntry,
)
from .permissions import IsInventoryMember
from .serializers import (
    ArticleAttachmentSerializer,
    ArticleCategorySerializer,
    CategoryFieldSerializer,
    InventoryEntrySerializer,
    InventorySerializer,
)

ARTICLE_LUCIDE_ICONS = frozenset(LUCIDE_ARTICLE_ICONS)


class InventoryViewSet(StandardOrAPIKeyAuthMixin, viewsets.ReadOnlyModelViewSet):
    """ Viewset for listing and retrieving inventories. """
    serializer_class = InventorySerializer
    permission_classes = (IsAuthenticated, IsInventoryMember)
    http_method_names = ("get", "head", "options")

    def get_queryset(self):
        return Inventory.objects.filter(users=self.request.user).order_by("name")


class InventoryAccessMixin:
    """ Mixin to provide inventory access methods for API views. """
    def get_inventory(self, request, inventory_uuid):
        return get_object_or_404(request.user.inventories.all(), uuid=inventory_uuid)


# region Base classses
class InventoryScopedViewSet(viewsets.ModelViewSet):
    """ Base class for viewsets that are scoped to a specific inventory.  (Handle inventory + authentication)"""
    permission_classes = (IsAuthenticated, IsInventoryMember)
    select_related_fields = ("inventory",)
    prefetch_related_fields = ()
    ordering = ("name",)

    def get_accessible_inventories(self):
        return self.request.user.inventories.all()

    def get_queryset(self):
        """ Get the queryset for the viewset, filtered by accessible inventories and optional query parameters. """
        # Basic scoping for GET, PUT, PATCH, DELETE
        queryset = super().get_queryset().filter(inventory__in=self.get_accessible_inventories())
        inventory_uuid = self.request.query_params.get("inventory")
        if inventory_uuid:
            queryset = queryset.filter(inventory__uuid=inventory_uuid)

        if queryset.model is InventoryEntry:
            # For InventoryEntry, we support additional filtering by parent/ancestor and type.
            accessible_entries = InventoryEntry.objects.filter(inventory__in=self.get_accessible_inventories())
            if inventory_uuid:
                accessible_entries = accessible_entries.filter(inventory__uuid=inventory_uuid)
            
            # If the payload includes a `within` parameter, we filter to only include entries that are descendants of the specified entry.
            if self.request.query_params.get("within"):
                try:
                    root_id = uuid.UUID(self.request.query_params["within"])
                except (ValueError, TypeError, AttributeError):
                    return queryset.none()
                if not accessible_entries.filter(pk=root_id).exists():
                    return queryset.none()
                descendant_ids = {root_id}
                frontier = {root_id}
                while frontier:
                    children = set(accessible_entries.filter(parent_id__in=frontier).values_list("pk", flat=True))
                    frontier = children - descendant_ids
                    descendant_ids.update(frontier)
                queryset = queryset.filter(pk__in=descendant_ids)

            # If the payload includes an `ids` parameter, we filter to only include entries with the specified IDs.
            if self.request.query_params.get("ids"):
                try:
                    entry_ids = [uuid.UUID(value) for value in self.request.query_params["ids"].split(",") if value]
                except (ValueError, TypeError, AttributeError):
                    return queryset.none()
                queryset = queryset.filter(pk__in=entry_ids)

            if getattr(self, "entry_type", None):
                queryset = queryset.filter(type=self.entry_type)
            # If the payload includes a `type` parameter, we filter to only include entries of the specified type.
            elif self.request.query_params.get("type"):
                queryset = queryset.filter(type=self.request.query_params["type"])

            # If the payload includes an `include_ancestors` parameter, we include all ancestor entries of the specified entries.
            if self.request.query_params.get("include_ancestors") == "true":
                result_ids = set(queryset.values_list("pk", flat=True))
                frontier = set(queryset.exclude(parent_id__isnull=True).values_list("parent_id", flat=True)) # frontier is the set of parent IDs of the current result set
                while frontier:
                    parents = list(
                        accessible_entries.filter(pk__in=frontier).values_list("pk", "parent_id")
                    )
                    next_frontier = set()
                    for parent_id, grandparent_id in parents:
                        result_ids.add(parent_id)
                        if grandparent_id and grandparent_id not in result_ids:
                            next_frontier.add(grandparent_id)
                    frontier = next_frontier
                queryset = accessible_entries.filter(pk__in=result_ids)
        
        if self.select_related_fields:
            queryset = queryset.select_related(*self.select_related_fields)
        if self.prefetch_related_fields:
            queryset = queryset.prefetch_related(*self.prefetch_related_fields)
                
        return queryset

    def perform_create(self, serializer):
        inventory = serializer.validated_data.get('inventory')
        
        if inventory is None or not self.get_accessible_inventories().filter(pk=inventory.pk).exists():
            raise PermissionDenied("You do not have permission to create objects in this inventory.")
            
        serializer.save()

    def perform_update(self, serializer):
        inventory = serializer.validated_data.get('inventory', serializer.instance.inventory)
        
        if inventory is None or not self.get_accessible_inventories().filter(pk=inventory.pk).exists():
            raise PermissionDenied("You do not have permission to update objects in this inventory.")
            
        serializer.save()


class InventoryScopedAPIView(APIView):
    """ Base class for API views that are scoped to a specific inventory.  (Handle inventory + authentication)"""
    """ Advanced filterings like entryType is handled in the specific APIViews"""
    permission_classes = (IsAuthenticated, IsInventoryMember)

    def get_accessible_inventories(self):
        return self.request.user.inventories.all()

# endregion Base classes

# region Inventory Settings/ Management Views
class InventoryMembersView(InventoryAccessMixin, APIView):
    """ API view for managing members of a specific inventory."""
    permission_classes = (IsAuthenticated, IsInventoryMember)

    def get(self, request, inventory_uuid):
        inventory = self.get_inventory(request, inventory_uuid)
        members = inventory.users.order_by("name", "username")
        available_users = (
            CustomUser.objects.exclude(inventories=inventory).order_by("name", "username")
            if settings.ALLOW_INVENTORY_USER_INVITES
            else CustomUser.objects.none()
        )
        return Response({
            "inventory": InventorySerializer(inventory).data,
            "members": UserSerializer(members, many=True).data,
            "available_users": UserSerializer(available_users, many=True).data,
            "can_invite": settings.ALLOW_INVENTORY_USER_INVITES,
        })

    def post(self, request, inventory_uuid):
        if not settings.ALLOW_INVENTORY_USER_INVITES:
            return Response({"error": "Inventory user invites are disabled."}, status=403)
        inventory = self.get_inventory(request, inventory_uuid)
        user = get_object_or_404(CustomUser, uuid=request.data.get("user_uuid"))
        inventory.users.add(user)
        return Response(UserSerializer(user).data, status=201)

    def delete(self, request, inventory_uuid, user_uuid):
        inventory = self.get_inventory(request, inventory_uuid)
        user = get_object_or_404(CustomUser, uuid=user_uuid)
        inventory.users.remove(user)

        if not inventory.users.exists():
            inventory.delete()
            return Response({"message": "Inventory deleted as it has no remaining members."}, status=204)
        return Response(status=204)


class InventoryManageView(InventoryAccessMixin, APIView):
    permission_classes = (IsAuthenticated, IsInventoryMember)

    def get(self, request, inventory_uuid):
        inventory = self.get_inventory(request, inventory_uuid)
        return Response(InventorySerializer(inventory).data)

    def patch(self, request, inventory_uuid):
        inventory = self.get_inventory(request, inventory_uuid)
        serializer = InventorySerializer(
            inventory,
            data={"name": request.data.get("name")},
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, inventory_uuid):
        inventory = self.get_inventory(request, inventory_uuid)
        inventory.delete()
        return Response(status=204)

class ExportInventoryView(StandardOrAPIKeyAuthMixin, InventoryAccessMixin, APIView):
    permission_classes = (IsAuthenticated, IsInventoryMember)

    def get(self, request, inventory_uuid):
        inventory = self.get_inventory(request, inventory_uuid)
        archive_file = generate_inventory_csv_export(inventory)
        archive_file.seek(0)
        response = FileResponse(archive_file, content_type="application/zip")
        response["Content-Disposition"] = f'attachment; filename="inventory-{inventory.uuid}-csv-export.zip"'
        return response

# endregion Inventory Settings/ Management Views


class DashboardView(StandardOrAPIKeyAuthMixin, InventoryScopedAPIView):
    def get(self, request, *args, **kwargs):
        inventories = self.get_accessible_inventories()
        inventory_uuid = request.query_params.get("inventory")
        if inventory_uuid:
            inventories = inventories.filter(uuid=inventory_uuid)
        scoped_models = (
            ("area", "area"),
            ("shelf", "shelf"),
            ("box", "box"),
            ("article", "article"),
            (ArticleCategory, "category", "name"),
            (CategoryField, "field", "label"),
        )

        counts = {
            "areas": InventoryEntry.objects.filter(inventory__in=inventories, type="area").count(),
            "articles": InventoryEntry.objects.filter(inventory__in=inventories, type="article").count(),
            "categories": ArticleCategory.objects.filter(inventory__in=inventories).count(),
        }
        category_counts = (
            InventoryEntry.objects.filter(inventory__in=inventories, type="article")
            .values("category__name")
            .annotate(count=Count("uuid"))
            .order_by("-count", "category__name")
        )

        last_added = []
        for item in scoped_models:
            if len(item) == 2:
                entry_type, object_type = item
                model, name_field = InventoryEntry, "name"
                queryset = model.objects.filter(inventory__in=inventories, type=entry_type)
            else:
                model, object_type, name_field = item
                queryset = model.objects.filter(inventory__in=inventories)
            fields = {"uuid", name_field, "created_at"}
            for item in queryset.values(*fields).order_by("-created_at")[:10]:
                last_added.append({
                    "uuid": str(item["uuid"]),
                    "name": item[name_field],
                    "type": object_type,
                    "created_at": item["created_at"],
                })

        last_added.sort(key=lambda item: item["created_at"], reverse=True)
        return Response({
            "counts": counts,
            "category_counts": [
                {"name": item["category__name"] or "No category", "count": item["count"]}
                for item in category_counts
            ],
            "last_added": last_added[:4],
        })


class InventoryEntryViewSet(StandardOrAPIKeyAuthMixin, InventoryScopedViewSet):
    queryset = InventoryEntry.objects.all() # We use a base queryset here, but the actual queryset is filtered in get_queryset() based on accessible inventories and query parameters.
    serializer_class = InventoryEntrySerializer
    select_related_fields = ("inventory", "parent", "category")
    prefetch_related_fields = (
        "field_values__field",
        Prefetch("inventory__categoryfield_set", queryset=CategoryField.objects.all(), to_attr="_category_fields"),
    )
    ordering = ("name",)

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.type == "box":
            delete_contents = request.query_params.get("delete_contents", "false").lower() in ("true", "1", "on")
            if not delete_contents:
                instance.children.update(parent_id=instance.parent_id)
        self.perform_destroy(instance)
        return Response(status=204)


class ArticleCategoryViewSet(StandardOrAPIKeyAuthMixin, InventoryScopedViewSet):
    queryset = ArticleCategory.objects.all()
    serializer_class = ArticleCategorySerializer


class CategoryFieldViewSet(StandardOrAPIKeyAuthMixin, InventoryScopedViewSet):
    queryset = CategoryField.objects.all()
    serializer_class = CategoryFieldSerializer
    select_related_fields = ("inventory", "category")


class ArticleAttachmentsView(InventoryScopedAPIView):
    """ API view for managing attachments for inventory entries of type 'article'."""
    parser_classes = (MultiPartParser, FormParser)

    def get_entry(self, request):
        entry_uuid = request.query_params.get("entry")
        if not entry_uuid:
            return None
        return get_object_or_404(
            InventoryEntry.objects.filter(inventory__in=self.get_accessible_inventories(), type="article"),
            uuid=entry_uuid,
        )

    def get(self, request):
        entry = self.get_entry(request)
        if entry is None:
            return Response({"entry": "An entry UUID is required."}, status=400)
        items = entry.attachments.order_by("created_at")
        return Response(ArticleAttachmentSerializer(items, many=True, context={"request": request}).data)

    def post(self, request):
        entry = self.get_entry(request)
        if entry is None:
            return Response({"entry": "An entry UUID is required."}, status=400)
        uploaded = request.FILES.get("file")
        if uploaded is None:
            return Response({"file": "A file is required."}, status=400)
        attachment = ArticleAttachment(entry=entry, original_name=uploaded.name[:255], file=uploaded)
        try:
            attachment.full_clean()
        except DjangoValidationError as error:
            return Response({"file": error.messages}, status=400)
        attachment.save()
        return Response(ArticleAttachmentSerializer(attachment, context={"request": request}).data, status=201)


    def delete(self, request):
        attachment_id = request.query_params.get("id")
        if not attachment_id:
            return Response({"id": "An attachment ID is required."}, status=400)
        attachment = get_object_or_404(
            ArticleAttachment.objects.filter(entry__inventory__in=self.get_accessible_inventories()),
            pk=attachment_id,
        )
        attachment.file.delete(save=False)
        attachment.delete()
        return Response(status=204)


class SearchView(StandardOrAPIKeyAuthMixin, InventoryScopedAPIView):
    """
    Search for articles in the inventory.
    """
    def get(self, request, *args, **kwargs):
        query = request.query_params.get("q", "")
        if not query:
            return Response({"error": "Query parameter 'q' is required."}, status=400)

        inventory = request.query_params.get("inventory")
        if not inventory:
            return Response({"error": "Query parameter 'inventory' is required."}, status=400)
        entries = InventoryEntry.objects.filter(
            inventory__in=self.get_accessible_inventories(),
            inventory__uuid=inventory,
            name__icontains=query
        ).filter(type__in=("article", "box")).select_related("inventory", "parent", "category").prefetch_related("field_values__field")
        results = InventoryEntrySerializer(entries, many=True, context={"request": request}).data
        return Response(results)


# region QR/ BARCODE VIEWS

class CodeLookupView(StandardOrAPIKeyAuthMixin, InventoryScopedAPIView):
    def post(self, request, *args, **kwargs):
        identifier = str(request.data.get("identifier", "")).strip()
        if not identifier:
            return Response({"error": "identifier is required."}, status=400)
        
        inventory_uuid = request.data.get("inventory") or request.data.get("inventory_uuid")
        accessible_inventories = self.get_accessible_inventories()

        item = None

        if inventory_uuid:
            item = InventoryEntry.objects.filter(
                inventory__in=accessible_inventories,
                inventory__uuid=inventory_uuid,
                identifier=identifier,
            ).first()

        if item is None:
            item = InventoryEntry.objects.filter(
                inventory__in=accessible_inventories,
                identifier=identifier,
            ).first()

        if item is not None:
            return Response({
                "uuid": str(item.uuid),
                "identifier": item.identifier,
                "name": getattr(item, "name", str(item)),
                "type": item.type,
                "inventory": {
                    "uuid": str(item.inventory.uuid),
                    "name": item.inventory.name,
                },
            })

        return Response({"error": "No inventory item was found for this code."}, status=404)

class CodePdfView(StandardOrAPIKeyAuthMixin, InventoryScopedAPIView):
    page_sizes: ClassVar[dict[str, tuple[str, int, int]]] = {
        "a4": ("A4", 210, 297),
        "a5": ("A5", 148, 210),
        "letter": ("Letter", 216, 279),
    }
    code_types = ("qr", "barcode")
    layouts = ("horizontal", "vertical")

    def post(self, request, *args, **kwargs):
        item_uuids = request.data.get("uuids")
        code_type = request.data.get("code_type", "qr")
        page_size_name = str(request.data.get("size", "a4")).lower()
        layout = request.data.get("layout", "vertical")

        if not isinstance(item_uuids, list) or not item_uuids:
            return Response({"error": "uuids must be a non-empty list."}, status=400)
        if code_type not in self.code_types:
            return Response({"error": "code_type must be qr or barcode."}, status=400)
        if page_size_name not in self.page_sizes:
            return Response({"error": "size must be a4, a5, or letter."}, status=400)
        if layout not in self.layouts:
            return Response({"error": "layout must be horizontal or vertical."}, status=400)

        accessible = self.get_accessible_inventories()
        selected_items = []
        invalid_uuids = []
        for raw_uuid in item_uuids:
            try:
                item_uuid = uuid.UUID(str(raw_uuid))
            except (ValueError, AttributeError):
                invalid_uuids.append(str(raw_uuid))
                continue

            match = InventoryEntry.objects.filter(
                uuid=item_uuid,
                inventory__in=accessible,
            ).first()
            if match is not None:
                selected_items.append((match, match.type))
            if match is None:
                invalid_uuids.append(str(raw_uuid))

        if invalid_uuids:
            return Response({"error": "Some selected items are invalid or inaccessible.", "uuids": invalid_uuids}, status=400)

        pdf_buffer = generate_codes_pdf(selected_items, code_type, page_size_name, layout)
        response = FileResponse(pdf_buffer, content_type="application/pdf")
        response["Content-Disposition"] = 'attachment; filename="openinvento-codes.pdf"'
        return response

# endregion QR/ BARCODE VIEWS

# region Magic inventoy import/ barcode lookup

class BarcodeProductLookupView(StandardOrAPIKeyAuthMixin, InventoryScopedAPIView):
    """Look up a scanned product through the inventory's configured catalog provider."""

    def post(self, request):
        barcode = str(request.data.get("barcode", "")).strip()
        inventory_uuid = request.data.get("inventory")
        if not barcode or len(barcode) > 80:
            return Response({"error": "A valid barcode is required."}, status=400)
        try:
            uuid.UUID(str(inventory_uuid))
        except (ValueError, TypeError, AttributeError):
            inventory_uuid = None
        if inventory_uuid is None or not self.get_accessible_inventories().filter(uuid=inventory_uuid).exists():
            return Response({"error": "Select an inventory you can access."}, status=400)
        from third_party_providers.models import ThirdPartyProvider
        provider_uuid = request.data.get("provider")
        try:
            provider_uuid = uuid.UUID(str(provider_uuid)) if provider_uuid else None
        except (ValueError, TypeError, AttributeError):
            provider_uuid = None
        configured_provider = ThirdPartyProvider.objects.filter(
            uuid=provider_uuid, inventory__uuid=inventory_uuid, type="barcode_lookup", provider="openfoodfacts"
        ).first() if provider_uuid else None
        if configured_provider is None:
            return Response({"error": "Select a configured barcode lookup provider in inventory settings."}, status=503)
        try:
            OPENFOODFACTS_API_URL = "https://world.openfoodfacts.org/api/v2/product/"
            req = Request(f"{OPENFOODFACTS_API_URL}{quote(barcode, safe='')}.json", headers={"User-Agent": "OpenInvento/1.0 (barcode lookup)"})
            with urlopen(req, timeout=8) as response:
                payload = json.loads(response.read())
            product = payload.get("product") or {}
            if payload.get("status") != 1 or not product:
                return Response({"error": "No product was found for this barcode."}, status=404)
            return Response({
                "barcode": barcode,
                "name": product.get("product_name") or product.get("product_name_en") or "",
                "brand": product.get("brands") or "",
                "description": product.get("generic_name") or product.get("quantity") or "",
                "image": product.get("image_front_url") or product.get("image_url"),
                "source": "Open Food Facts",
            })
        except HTTPError as error:
            if error.code == 404:
                return Response({"error": "No product was found for this barcode."}, status=404)
            return Response({"error": "Open Food Facts could not be reached."}, status=502)
        except (URLError, TimeoutError, ValueError, http.client.HTTPException):
             return Response({"error": "Open Food Facts could not be reached."}, status=502)

class MagicArticleImportView(InventoryScopedAPIView):
    """Analyze an uploaded image and return article-shaped drafts for review."""
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request):
        image = request.FILES.get("image")
        if image is None:
            return Response({"image": "An image file is required."}, status=400)
        if image.content_type not in {"image/jpeg", "image/png"}:
            return Response({"image": "Upload a JPEG or PNG image."}, status=400)

        from PIL import Image, UnidentifiedImageError
        try:
            with Image.open(image) as probe:
                probe.verify()
                if probe.format not in {"JPEG", "PNG"}:
                    raise UnidentifiedImageError
            image.seek(0)
        except (UnidentifiedImageError, OSError, Image.DecompressionBombError, SyntaxError):
            return Response({"image": "Upload a valid JPEG or PNG image."}, status=400)
            
        
        if image.size > settings.MAX_FILE_SIZE:
            return Response({"image": "The image exceeds the maximum upload size."}, status=400)
        inventory_uuid = request.data.get("inventory")
        if not inventory_uuid or not self.get_accessible_inventories().filter(uuid=inventory_uuid).exists():
            return Response({"inventory": "Select an inventory you can access."}, status=400)

        from third_party_providers.models import ThirdPartyProvider
        provider_uuid = request.data.get("provider")
        try:
            provider_uuid = uuid.UUID(str(provider_uuid)) if provider_uuid else None
        except (ValueError, TypeError, AttributeError):
            provider_uuid = None
        configured_provider = ThirdPartyProvider.objects.filter(
            uuid=provider_uuid, inventory__uuid=inventory_uuid, type="object_detection_llm"
        ).first() if provider_uuid else None
        if configured_provider is None:
            return Response({"error": "Select a configured object detection provider in inventory settings."}, status=503)

        provider, api_key = configured_provider.provider, configured_provider.api_key
        if provider == "gemini" and not api_key:
            return Response({"error": "Add a Gemini API key in this inventory's settings to use image import."}, status=503)

        suffix = ".png" if image.content_type == "image/png" else ".jpg"
        temporary_path = None
        try:
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as temporary_image:
                temporary_path = temporary_image.name
                for chunk in image.chunks():
                    temporary_image.write(chunk)

            from ai_features.object_detection.main import analyze_image_to_json_objects
            result = analyze_image_to_json_objects(
                provider,
                temporary_path,
                api_key=api_key,
                model=configured_provider.model_name or None,
            )

            if not isinstance(result, dict) or not isinstance(result.get("objects"), list):
                raise ValueError("Image analysis returned an invalid response.")
            articles = []
            for item in result.get("objects", []):
                try:
                    quantity = max(1, int(item.get("quantity", 1)))
                except (TypeError, ValueError):
                    quantity = 1
                detected_icon = item.get("icon")
                articles.append({
                    "name": str(item.get("name", "")).strip()[:100],
                    "description": str(item.get("description", "")).strip()[:750],
                    "quantity": quantity,
                    "icon": detected_icon if isinstance(detected_icon, str) and detected_icon in ARTICLE_LUCIDE_ICONS else "Package",
                    "area": None,
                    "shelf": None,
                    "box": None,
                    "category": None,
                    "stock_tracking": False,
                })
            return Response({"articles": [article for article in articles if article["name"]]})
        except Exception:
            logger.exception("Error during magic article import")
            return Response({"error": "Image analysis failed."}, status=502)
        finally:
            if temporary_path and os.path.exists(temporary_path):
                os.unlink(temporary_path)

# endregion Magic inventoy import
