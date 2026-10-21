from urllib.parse import urlsplit

from django.conf import settings
from django.db.models import Q
from rest_framework import serializers
from rest_framework.reverse import reverse

from .models import (
    Area,
    Article,
    ArticleAttachment,
    ArticleCategory,
    ArticleFieldValue,
    Box,
    CategoryField,
    Inventory,
    Shelf,
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
    class Meta:
        model = Inventory
        fields = ("uuid", "name", "identifier", "updated_at")
        read_only_fields = ("uuid", "identifier", "updated_at")


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


class ProtectedImageField(serializers.ImageField):
    """ Custom ImageField that returns a full URL for the image """
    """Expand this later for adding support for nginx or S3 storage buckets """
    def to_representation(self, value):
        if not value:
            return None

        media_path = reverse("media", kwargs={"path": value.name})
        return _trusted_media_url(self.context.get("request"), media_path)


class AreaSerializer(InventoryScopedSerializer):
    identifier = serializers.CharField(required=False, allow_blank=True, max_length=30)
    class Meta:
        model = Area
        fields = ("uuid", "identifier", "inventory", "created_at", "updated_at", "name")
        read_only_fields = ("uuid", "created_at", "updated_at")

class ShelfSerializer(InventoryScopedSerializer):
    area = serializers.PrimaryKeyRelatedField(queryset=Area.objects.none())

    class Meta:
        model = Shelf
        fields = ("uuid", "identifier", "inventory", "created_at", "updated_at", "name", "area")
        read_only_fields = ("uuid", "identifier", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["area"].queryset = self._inventory_queryset(Area)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        area = attrs.get("area") or getattr(self.instance, "area", None)
        if area is None:
            raise serializers.ValidationError({"area": "Area is required."})
        return attrs


class BoxSerializer(InventoryScopedSerializer):
    identifier = serializers.CharField(required=False, allow_blank=True, max_length=30)
    area = serializers.PrimaryKeyRelatedField(queryset=Area.objects.none())
    shelf = serializers.PrimaryKeyRelatedField(queryset=Shelf.objects.none(), required=False, allow_null=True)
    parent_box = serializers.PrimaryKeyRelatedField(
        queryset=Box.objects.none(), required=False, allow_null=True
    )

    class Meta:
        model = Box
        fields = (
            "uuid",
            "identifier",
            "inventory",
            "created_at",
            "updated_at",
            "name",
            "area",
            "shelf",
            "parent_box",
        )
        read_only_fields = ("uuid", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["area"].queryset = self._inventory_queryset(Area)
        self.fields["shelf"].queryset = self._inventory_queryset(Shelf)
        self.fields["parent_box"].queryset = self._inventory_queryset(Box)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        area = attrs.get("area") or getattr(self.instance, "area", None)
        shelf = attrs.get("shelf") if "shelf" in attrs else getattr(self.instance, "shelf", None)
        parent_box = (
            attrs.get("parent_box")
            if "parent_box" in attrs
            else getattr(self.instance, "parent_box", None)
        )

        if area is None:
            raise serializers.ValidationError({"area": "Area is required."})

        if shelf is not None and shelf.area_id != area.uuid:
            raise serializers.ValidationError({"shelf": "Shelf must belong to the selected area."})

        if parent_box is not None:
            if self.instance is not None:
                ancestor = parent_box
                visited = set()
                while ancestor is not None and ancestor.pk not in visited:
                    if ancestor.pk == self.instance.pk:
                        raise serializers.ValidationError(
                            {"parent_box": "A box cannot be its own ancestor."}
                        )
                    visited.add(ancestor.pk)
                    ancestor = ancestor.parent_box
            if parent_box.area_id != area.uuid:
                raise serializers.ValidationError(
                    {"parent_box": "Parent box must belong to the selected area."}
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

class ArticleSerializer(InventoryScopedSerializer):
    identifier = serializers.CharField(required=False, allow_blank=True, max_length=30)
    area = serializers.PrimaryKeyRelatedField(queryset=Area.objects.none(), required=False, allow_null=True)
    shelf = serializers.PrimaryKeyRelatedField(queryset=Shelf.objects.none(), required=False, allow_null=True)
    box = serializers.PrimaryKeyRelatedField(queryset=Box.objects.none(), required=False, allow_null=True)
    category = serializers.PrimaryKeyRelatedField(
        queryset=ArticleCategory.objects.none(), required=False, allow_null=True
    )
    category_fields = serializers.SerializerMethodField()
    custom_fields = serializers.SerializerMethodField()
    date_notifications = serializers.SerializerMethodField()
    image = ProtectedImageField(required=False, allow_null=True) # Use the custom ProtectedImageField for the image field

    class Meta:
        model = Article
        fields = (
            "uuid",
            "identifier",
            "inventory",
            "created_at",
            "updated_at",
            "name",
            "description",
            "area",
            "shelf",
            "box",
            "quantity",
            "stock_tracking",
            "image",
            "icon",
            "category",
            "custom_fields",
            "date_notifications",
            "category_fields",
        )
        read_only_fields = ("uuid", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["area"].queryset = self._inventory_queryset(Area)
        self.fields["shelf"].queryset = self._inventory_queryset(Shelf)
        self.fields["box"].queryset = self._inventory_queryset(Box)
        self.fields["category"].queryset = self._inventory_queryset(ArticleCategory)

    def get_category_fields(self, obj):
        if obj.category is None:
            return CategoryFieldSerializer(
                CategoryField.objects.filter(inventory=obj.inventory, category__isnull=True), many=True
            ).data
        fields = CategoryField.objects.filter(inventory=obj.inventory).filter(
            Q(category__isnull=True) | Q(category=obj.category)
        )
        return CategoryFieldSerializer(fields, many=True).data

    def get_custom_fields(self, obj):
        return {
            row.field.key: row.value
            for row in obj.field_values.select_related("field").all()
        }

    def get_date_notifications(self, obj):
        return {
            row.field.key: row.notify_on_date
            for row in obj.field_values.select_related("field").all()
            if row.field.field_type == "date"
        }

    def to_internal_value(self, data):
        attrs = super().to_internal_value(data)
        for name in ("custom_fields", "date_notifications"):
            if name in data:
                try:
                    attrs[name] = serializers.JSONField().run_validation(data.get(name))
                except serializers.ValidationError as error:
                    raise serializers.ValidationError({name: error.detail}) from error
        return attrs

    def get_image(self, obj):
        if not obj.image:
            return None

        # Use the frontend request URL for media serving

        media_path = reverse("media", kwargs={"path": obj.image.name})

        return _trusted_media_url(self.context.get("request"), media_path)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        area = attrs.get("area") if "area" in attrs else getattr(self.instance, "area", None)
        shelf = attrs.get("shelf") if "shelf" in attrs else getattr(self.instance, "shelf", None)
        box = attrs.get("box") if "box" in attrs else getattr(self.instance, "box", None)

        if shelf is not None and area is not None and shelf.area_id != area.uuid:
            raise serializers.ValidationError({"shelf": "Shelf must belong to the selected area."})

        if box is not None:
            if area is not None and box.area_id != area.uuid:
                raise serializers.ValidationError({"box": "Box must belong to the selected area."})
            if shelf is not None and box.shelf_id is not None and box.shelf_id != shelf.uuid:
                raise serializers.ValidationError({"box": "Box must belong to the selected shelf."})

        custom_fields = attrs.get("custom_fields")
        if custom_fields is not None and not isinstance(custom_fields, dict):
            raise serializers.ValidationError({"custom_fields": "Expected an object."})

        date_notifications = attrs.get("date_notifications")
        if date_notifications is not None and (
            not isinstance(date_notifications, dict)
            or any(not isinstance(enabled, bool) for enabled in date_notifications.values())
        ):
            raise serializers.ValidationError({"date_notifications": "Expected an object of boolean values."})

        inventory = attrs.get("inventory", getattr(self.instance, "inventory", None))
        if inventory is not None:
            fields = CategoryField.objects.filter(inventory=inventory)
            fields_by_key = {}
            for field in fields:
                fields_by_key.setdefault(field.key, []).append(field)

            if custom_fields is not None:
                invalid_keys = [key for key in custom_fields if key not in fields_by_key]
                if invalid_keys:
                    raise serializers.ValidationError({"custom_fields": f"Unknown field key(s): {', '.join(invalid_keys)}"})

            if date_notifications is not None:
                invalid_keys = [
                    key for key in date_notifications
                    if not any(field.field_type == "date" for field in fields_by_key.get(key, []))
                ]
                if invalid_keys:
                    raise serializers.ValidationError({"date_notifications": f"Unknown date field key(s): {', '.join(invalid_keys)}"})

        return attrs

    def _save_field_values(self, article, custom_fields, date_notifications):
        if custom_fields is None and date_notifications is None:
            return

        fields = CategoryField.objects.filter(inventory=article.inventory)
        preferred_fields = {}
        for field in fields:
            if field.category_id is None or field.category_id == article.category_id:
                if field.category_id == article.category_id:
                    preferred_fields[field.key] = field
                else:
                    preferred_fields.setdefault(field.key, field)

        keys = set(custom_fields or {}) | set(date_notifications or {})
        for key in keys:
            field = preferred_fields.get(key)
            if field is None:
                continue
            current = ArticleFieldValue.objects.filter(article=article, field=field).first()
            value = (custom_fields or {}).get(key, current.value if current else None)
            notify = (date_notifications or {}).get(
                key, current.notify_on_date if current else False
            )
            ArticleFieldValue.objects.update_or_create(
                article=article,
                field=field,
                defaults={"value": value, "notify_on_date": notify if field.field_type == "date" else False},
            )

    def create(self, validated_data):
        custom_fields = validated_data.pop("custom_fields", None)
        date_notifications = validated_data.pop("date_notifications", None)
        article = super().create(validated_data)
        self._save_field_values(article, custom_fields, date_notifications)
        return article

    def update(self, instance, validated_data):
        custom_fields = validated_data.pop("custom_fields", None)
        date_notifications = validated_data.pop("date_notifications", None)
        article = super().update(instance, validated_data)
        self._save_field_values(article, custom_fields, date_notifications)
        return article


class ArticleAttachmentSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    size = serializers.IntegerField(source="file.size", read_only=True)

    class Meta:
        model = ArticleAttachment
        fields = ("id", "original_name", "url", "size", "created_at")
        read_only_fields = fields

    def get_url(self, obj):
        media_path = reverse("media", kwargs={"path": obj.file.name})
        return _trusted_media_url(self.context.get("request"), media_path)


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
