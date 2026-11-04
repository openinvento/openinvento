from urllib.parse import urlsplit

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers
from rest_framework.reverse import reverse

from .models import (
    ArticleAttachment,
    ArticleCategory,
    ArticleFieldValue,
    CategoryField,
    Inventory,
    InventoryEntry,
    InventoryEntryType,
)


def _trusted_media_url(request, media_path):
    configured_origins = set(getattr(settings, "APP_URLS", []))
    if getattr(settings, "APP_URL", ""):
        configured_origins.add(settings.APP_URL)
    origin = request.headers.get("Origin") if request is not None else None
    if origin and origin in configured_origins:
        parsed_origin = urlsplit(origin)
        return f"{parsed_origin.scheme}://{parsed_origin.netloc}{media_path}"
    return media_path


class InventorySerializer(serializers.ModelSerializer):
    # Members come from the OpenID provider; the members page shows a hint instead of invite/remove.
    oidc_managed = serializers.BooleanField(read_only=True)

    class Meta:
        model = Inventory
        fields = ("uuid", "name", "identifier", "updated_at", "oidc_managed")
        read_only_fields = ("uuid", "identifier", "updated_at")


class ProtectedImageField(serializers.ImageField):
    """ Custom ImageField that returns a full URL for the image """
    """Expand this later for adding support for nginx or S3 storage buckets """
    def to_representation(self, value):
        if not value:
            return None
        media_path = reverse("media", kwargs={"path": value.name})
        return _trusted_media_url(self.context.get("request"), media_path)


class InventoryEntrySerializer(serializers.ModelSerializer):
    """ Serializer for InventoryEntry model, including validation for parent-child relationships and field values. """
    type = serializers.ChoiceField(choices=InventoryEntryType.choices)
    parent = serializers.PrimaryKeyRelatedField(queryset=InventoryEntry.objects.none(), required=False, allow_null=True)
    category = serializers.PrimaryKeyRelatedField(queryset=ArticleCategory.objects.none(), required=False, allow_null=True)
    image = ProtectedImageField(required=False, allow_null=True)
    field_values = serializers.SerializerMethodField()
    category_fields = serializers.SerializerMethodField()
    field_values_input = serializers.JSONField(required=False, write_only=True, source="_field_values")

    class Meta:
        model = InventoryEntry
        fields = ("uuid", "identifier", "inventory", "created_at", "updated_at", "name", "type", "parent",
                  "description", "quantity", "stock_tracking", "image", "icon", "category", "field_values", "field_values_input", "category_fields")
        read_only_fields = ("uuid", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        inventories = request.user.inventories.all() if request and request.user.is_authenticated else Inventory.objects.none()
        self.fields["inventory"].queryset = inventories
        self.fields["parent"].queryset = InventoryEntry.objects.filter(inventory__in=inventories)
        self.fields["category"].queryset = ArticleCategory.objects.filter(inventory__in=inventories)

    def validate(self, attrs):
        """Validate the inventory entry, ensuring that the parent and type are consistent with the inventory and that field values are valid for articles."""
        if self.instance is not None: # self.instance is the current db object
            if "type" in attrs and attrs["type"] != self.instance.type:
                raise serializers.ValidationError({"type": "The entry type cannot be changed."})
            if "inventory" in attrs and attrs["inventory"].pk != self.instance.inventory_id:
                if self.instance.children.exists():
                    raise serializers.ValidationError({"inventory": "Entries with children cannot change inventory."})
                if self.instance.field_values.exists():
                    raise serializers.ValidationError({"inventory": "Entries with field values cannot change inventory."})
        inventory = attrs.get("inventory", getattr(self.instance, "inventory", None))
        parent = attrs.get("parent", getattr(self.instance, "parent", None))
        entry_type = attrs.get("type", getattr(self.instance, "type", None))
        entry_type_key = entry_type
        if inventory is None:
            raise serializers.ValidationError({"inventory": "Inventory is required."})
        candidate = self.instance or InventoryEntry()
        candidate.inventory = inventory
        candidate.parent = parent
        candidate.type = entry_type_key
        candidate.category = attrs.get("category", getattr(self.instance, "category", None))
        if self.instance:
            candidate.pk = self.instance.pk
        try:
            candidate.full_clean(exclude=["image", "name"], validate_unique=False)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        
        values = attrs.get("_field_values")
        if values is not None:
            if not isinstance(values, list):
                raise serializers.ValidationError({"field_values_input": "Expected a JSON list."})
            if entry_type_key != "article":
                raise serializers.ValidationError({"field_values_input": "Only articles can have field values."})
            fields = {str(field.pk): field for field in CategoryField.objects.filter(inventory=inventory)}
            seen_fields = set()
            for value in values:
                if not isinstance(value, dict):
                    raise serializers.ValidationError({"field_values_input": "Each item must be an object."})
                field_id = str(value.get("field", ""))
                field = fields.get(field_id)
                if field is None or field_id in seen_fields:
                    raise serializers.ValidationError({"field_values_input": "Invalid or duplicate field."})
                notify = value.get("notify_on_date", False)
                if not isinstance(notify, bool) or (notify and field.field_type != "date"):
                    raise serializers.ValidationError({"field_values_input": "Invalid date notification setting."})
                seen_fields.add(field_id)

        return attrs

    def get_field_values(self, obj):
        return [{"field": str(row.field_id), "key": row.field.key, "value": row.value,
                 "notify_on_date": row.notify_on_date}
                for row in obj.field_values.all()] if obj.type == "article" else []

    def get_category_fields(self, obj):
        if obj.type != "article":
            return []
        fields = getattr(obj.inventory, "_category_fields", None)
        if fields is None:
            fields = CategoryField.objects.filter(inventory=obj.inventory)
        fields = (
            [field for field in fields if field.category_id is None or field.category_id == obj.category_id]
            if obj.category_id
            else [field for field in fields if field.category_id is None]
        )
        return CategoryFieldSerializer(fields, many=True).data

    def create(self, validated_data):
        """Save field values for an article entry. This method is called during create operations."""
        values = validated_data.pop("_field_values", None)
        entry = super().create(validated_data)
        self._save_field_values(entry, values)
        return entry

    def update(self, instance, validated_data):
        """Save field values for an article entry. This method is called during update operations."""
        values = validated_data.pop("_field_values", None)
        entry = super().update(instance, validated_data)
        self._save_field_values(entry, values)
        return entry

    def _save_field_values(self, entry, values):
        """Save field values for an article entry. This method is called during create and update operations."""
        if values is None:
            return
        if entry.type != "article":
            raise serializers.ValidationError({"field_values_input": "Only articles can have field values."})
        allowed = {str(field.uuid): field for field in CategoryField.objects.filter(inventory=entry.inventory)}
        seen = set()
        for item in values:
            field_id = str(item.get("field", ""))
            field = allowed.get(field_id)
            if field is None or field_id in seen:
                raise serializers.ValidationError({"field_values_input": "Invalid or duplicate field."})
            seen.add(field_id)
            notify = item.get("notify_on_date", False)
            if not isinstance(notify, bool) or (notify and field.field_type != "date"):
                raise serializers.ValidationError({"field_values_input": "Invalid date notification setting."})
            ArticleFieldValue.objects.update_or_create(
                entry=entry, field=field,
                defaults={"value": item.get("value"), "notify_on_date": notify},
            )


class InventoryScopedSerializer(serializers.ModelSerializer):
    """ Base serializer for models that are scoped to a specific inventory.  (Handle inventory + authentication) """
    inventory = serializers.PrimaryKeyRelatedField(queryset=Inventory.objects.none())

    def _accessible_inventories(self):
        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            return Inventory.objects.none()
        return request.user.inventories.all()

    def _inventory_queryset(self, model):
        return model.objects.filter(inventory__in=self._accessible_inventories())

    def _validate_inventory_belongs_to_user(self, inventory):
        if not self._accessible_inventories().filter(pk=inventory.pk).exists():
            raise serializers.ValidationError({"inventory": "You do not have access to this inventory."})
        return inventory

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["inventory"].queryset = self._accessible_inventories()

    def validate(self, attrs):
        """Validate access and ownership for submitted and existing relations."""
        inventory = attrs.get("inventory") or getattr(self.instance, "inventory", None)
        if inventory is None:
            raise serializers.ValidationError({"inventory": "Inventory is required."})
        self._validate_inventory_belongs_to_user(inventory)

        for model_field in self.Meta.model._meta.get_fields():
            if not model_field.is_relation or model_field.auto_created or model_field.name == "inventory":
                continue
            field_name = model_field.name
            related_obj = attrs.get(field_name, getattr(self.instance, field_name, None))
            if related_obj is None:
                continue
            related_inventory = getattr(related_obj, "inventory", None)
            if related_inventory is not None and related_inventory.pk != inventory.pk:
                raise serializers.ValidationError(
                    {field_name: "This object must belong to the same inventory."}
                )
        return attrs


class ArticleCategorySerializer(InventoryScopedSerializer):
    category_fields = serializers.SerializerMethodField()

    class Meta:
        model = ArticleCategory
        fields = ("uuid", "identifier", "inventory", "created_at", "updated_at", "name", "category_fields")
        read_only_fields = ("uuid", "identifier", "created_at", "updated_at")

    def get_category_fields(self, obj):
        fields = CategoryField.objects.filter(inventory=obj.inventory, category=obj)
        return CategoryFieldSerializer(fields, many=True).data

class ArticleAttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    size = serializers.IntegerField(source="file.size", read_only=True)
    is_image = serializers.SerializerMethodField()

    class Meta:
        model = ArticleAttachment
        fields = ("id", "original_name", "url", "size", "is_image", "created_at")
        read_only_fields = fields

    def get_url(self, obj):
        media_path = reverse("media", kwargs={"path": obj.file.name})
        return _trusted_media_url(self.context.get("request"), media_path)

    def get_is_image(self, obj):
        return obj.file.name.lower().endswith((".jpg", ".jpeg", ".png"))


class CategoryFieldSerializer(InventoryScopedSerializer):
    category = serializers.PrimaryKeyRelatedField(
        queryset=ArticleCategory.objects.none(), required=False, allow_null=True
    )

    class Meta:
        model = CategoryField
        fields = (
            "uuid", "identifier", "inventory", "created_at", "updated_at",
            "key", "label", "field_type", "category",
            "options",
        )
        read_only_fields = ("uuid", "identifier", "created_at", "updated_at", "key")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["category"].queryset = self._inventory_queryset(ArticleCategory)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        return attrs
