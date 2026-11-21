from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

from account_auth.services import create_notification
from inventory.models import Inventory, InventoryEntry
from inventory.views import CodeLookupView

from .models import PublicPage


class PublicPageSerializer(serializers.ModelSerializer):
    class Meta:
        model = PublicPage
        fields = ("show_name", "show_photo", "note")


class PublicPageSettingsView(APIView):
    """Owner settings for one entry: GET reads them, PUT turns the public page on or updates it, DELETE turns it off."""

    permission_classes = (IsAuthenticated,)

    def get_entry(self, request, entry_uuid):
        return get_object_or_404(InventoryEntry, uuid=entry_uuid, inventory__users=request.user)

    def get(self, request, entry_uuid):
        page = get_object_or_404(PublicPage, entry=self.get_entry(request, entry_uuid))
        return Response(PublicPageSerializer(page).data)

    def put(self, request, entry_uuid):
        entry = self.get_entry(request, entry_uuid)
        page = PublicPage.objects.filter(entry=entry).first()
        serializer = PublicPageSerializer(page, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(entry=entry)
        return Response(serializer.data)

    def delete(self, request, entry_uuid):
        PublicPage.objects.filter(entry=self.get_entry(request, entry_uuid)).delete()
        return Response(status=204)


def get_public_entry(inventory, identifier):
    """The opted-in entry for a scan URL. Unknown codes and entries without opt-in get the same 404."""
    entry = CodeLookupView.find_by_inventory_and_identifier(identifier, inventory, Inventory.objects.all())
    page = PublicPage.objects.filter(entry=entry).select_related("entry__inventory").first() if entry else None
    if page is None:
        raise Http404
    return page


class PublicView(APIView):
    # DRF views are exempt from LoginRequiredMiddleware. No session: the page looks the same to everybody, and anonymous POSTs need no CSRF token.
    authentication_classes = ()
    permission_classes = (AllowAny,)


class PublicPageView(PublicView):
    def get(self, request, inventory, identifier):
        page = get_public_entry(inventory, identifier)
        return Response({
            "name": page.entry.name if page.show_name else None,
            "has_photo": bool(page.show_photo and page.entry.image),
            "note": page.note,
        })


class PublicPhotoView(PublicView):
    def get(self, request, inventory, identifier):
        page = get_public_entry(inventory, identifier)
        if not (page.show_photo and page.entry.image):
            raise Http404
        return FileResponse(page.entry.image.open("rb"))


class ContactThrottle(AnonRateThrottle):
    # Every message notifies all members of the inventory, so keep it far below the general anonymous rate.
    scope = "publicpage_contact"
    rate = "5/hour"


class ContactSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=1000)
    contact = serializers.CharField(max_length=200, required=False, allow_blank=True)


class PublicContactView(PublicView):
    throttle_classes = (ContactThrottle,)

    def post(self, request, inventory, identifier):
        page = get_public_entry(inventory, identifier)
        serializer = ContactSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = page.entry
        message = serializer.validated_data["message"]
        contact = serializer.validated_data.get("contact", "")
        if contact:
            message = f"{message}\n\nContact: {contact}"
        for user in entry.inventory.users.all():
            create_notification(
                user,
                kind="publicpage",
                title=f"New message about {entry.name}",
                message=message,
                # Resolves to the entry's page for signed-in members, whatever its type.
                link=f"/i/{entry.inventory.identifier}/{entry.identifier}",
                metadata={"entry_uuid": str(entry.uuid), "inventory_uuid": str(entry.inventory.uuid)},
            )
        return Response(status=204)
