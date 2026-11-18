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

from .models import LostFoundEntry


class LostFoundEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = LostFoundEntry
        fields = ("show_name", "show_photo", "note")


class LostFoundEntryView(APIView):
    """Owner settings for one entry: GET reads them, PUT turns the public page on or updates it, DELETE turns it off."""

    permission_classes = (IsAuthenticated,)

    def get_entry(self, request, entry_uuid):
        return get_object_or_404(InventoryEntry, uuid=entry_uuid, inventory__users=request.user)

    def get(self, request, entry_uuid):
        lostfound = get_object_or_404(LostFoundEntry, entry=self.get_entry(request, entry_uuid))
        return Response(LostFoundEntrySerializer(lostfound).data)

    def put(self, request, entry_uuid):
        entry = self.get_entry(request, entry_uuid)
        lostfound = LostFoundEntry.objects.filter(entry=entry).first()
        serializer = LostFoundEntrySerializer(lostfound, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(entry=entry)
        return Response(serializer.data)

    def delete(self, request, entry_uuid):
        LostFoundEntry.objects.filter(entry=self.get_entry(request, entry_uuid)).delete()
        return Response(status=204)


def get_public_entry(inventory, identifier):
    """The opted-in entry for a scan URL. Unknown codes and entries without opt-in get the same 404."""
    entry = CodeLookupView.find_by_inventory_and_identifier(identifier, inventory, Inventory.objects.all())
    lostfound = LostFoundEntry.objects.filter(entry=entry).select_related("entry__inventory").first() if entry else None
    if lostfound is None:
        raise Http404
    return lostfound


class PublicView(APIView):
    # DRF views are exempt from LoginRequiredMiddleware. No session: the page looks the same to everybody, and anonymous POSTs need no CSRF token.
    authentication_classes = ()
    permission_classes = (AllowAny,)


class FoundView(PublicView):
    def get(self, request, inventory, identifier):
        lostfound = get_public_entry(inventory, identifier)
        return Response({
            "name": lostfound.entry.name if lostfound.show_name else None,
            "has_photo": bool(lostfound.show_photo and lostfound.entry.image),
            "note": lostfound.note,
        })


class FoundPhotoView(PublicView):
    def get(self, request, inventory, identifier):
        lostfound = get_public_entry(inventory, identifier)
        if not (lostfound.show_photo and lostfound.entry.image):
            raise Http404
        return FileResponse(lostfound.entry.image.open("rb"))


class ContactThrottle(AnonRateThrottle):
    # Every message notifies all members of the inventory, so keep it far below the general anonymous rate.
    scope = "lostfound_contact"
    rate = "5/hour"


class ContactSerializer(serializers.Serializer):
    message = serializers.CharField(max_length=1000)
    contact = serializers.CharField(max_length=200, required=False, allow_blank=True)


class FoundContactView(PublicView):
    throttle_classes = (ContactThrottle,)

    def post(self, request, inventory, identifier):
        lostfound = get_public_entry(inventory, identifier)
        serializer = ContactSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry = lostfound.entry
        message = serializer.validated_data["message"]
        contact = serializer.validated_data.get("contact", "")
        if contact:
            message = f"{message}\n\nContact: {contact}"
        for user in entry.inventory.users.all():
            create_notification(
                user,
                kind="lostfound",
                title=f"Someone found {entry.name}",
                message=message,
                # Resolves to the entry's page for signed-in members, whatever its type.
                link=f"/i/{entry.inventory.identifier}/{entry.identifier}",
                metadata={"entry_uuid": str(entry.uuid), "inventory_uuid": str(entry.inventory.uuid)},
            )
        return Response(status=204)
