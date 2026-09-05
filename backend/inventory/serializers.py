from rest_framework import serializers

from .models import Area, Article, ArticleCategory, Chest, Inventory, Shelf


class InventorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Inventory
        fields = ("uuid", "name", "identifier", "updated_at")
        read_only_fields = fields


class InventoryScopedSerializer(serializers.ModelSerializer):
    """ Base serializer for models that are scoped to a specific inventory.  (Handle inventory + authentication) """
    inventory = serializers.PrimaryKeyRelatedField(queryset=Inventory.objects.none())

    def _accessible_inventories(self):
        request = self.context.get("request")
        if request is None or not request.user.is_authenticated:
            return Inventory.objects.none()
        if request.user.is_superuser:
            return Inventory.objects.all()
        return request.user.inventories.all()

    def _inventory_queryset(self, model):
        return model.objects.filter(inventory__in=self._accessible_inventories())

    def _validate_inventory_belongs_to_user(self, inventory):
        if not self._accessible_inventories().filter(pk=inventory.pk).exists():
            raise serializers.ValidationError({"inventory": "You do not have access to this inventory."})
        return inventory

    def _validate_same_inventory(self, field_name, related_obj, inventory):
        if related_obj is not None and related_obj.inventory_id != inventory.id:
            raise serializers.ValidationError(
                {field_name: "This object must belong to the same inventory."}
            )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["inventory"].queryset = self._accessible_inventories()


class AreaSerializer(InventoryScopedSerializer):
    class Meta:
        model = Area
        fields = ("uuid", "identifier", "inventory", "created_at", "updated_at", "name")
        read_only_fields = ("uuid", "identifier", "created_at", "updated_at")

    def validate(self, attrs):
        inventory = attrs.get("inventory") or getattr(self.instance, "inventory", None)
        if inventory is None:
            raise serializers.ValidationError({"inventory": "Inventory is required."})
        self._validate_inventory_belongs_to_user(inventory)
        return attrs


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
        inventory = attrs.get("inventory") or getattr(self.instance, "inventory", None)
        area = attrs.get("area") or getattr(self.instance, "area", None)
        if inventory is None:
            raise serializers.ValidationError({"inventory": "Inventory is required."})
        self._validate_inventory_belongs_to_user(inventory)
        if area is None:
            raise serializers.ValidationError({"area": "Area is required."})
        self._validate_same_inventory("area", area, inventory)
        return attrs


class ChestSerializer(InventoryScopedSerializer):
    area = serializers.PrimaryKeyRelatedField(queryset=Area.objects.none())
    shelf = serializers.PrimaryKeyRelatedField(queryset=Shelf.objects.none(), required=False, allow_null=True)
    parent_chest = serializers.PrimaryKeyRelatedField(
        queryset=Chest.objects.none(), required=False, allow_null=True
    )

    class Meta:
        model = Chest
        fields = (
            "uuid",
            "identifier",
            "inventory",
            "created_at",
            "updated_at",
            "name",
            "area",
            "shelf",
            "parent_chest",
        )
        read_only_fields = ("uuid", "identifier", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["area"].queryset = self._inventory_queryset(Area)
        self.fields["shelf"].queryset = self._inventory_queryset(Shelf)
        self.fields["parent_chest"].queryset = self._inventory_queryset(Chest)

    def validate(self, attrs):
        inventory = attrs.get("inventory") or getattr(self.instance, "inventory", None)
        area = attrs.get("area") or getattr(self.instance, "area", None)
        shelf = attrs.get("shelf") if "shelf" in attrs else getattr(self.instance, "shelf", None)
        parent_chest = (
            attrs.get("parent_chest")
            if "parent_chest" in attrs
            else getattr(self.instance, "parent_chest", None)
        )

        if inventory is None:
            raise serializers.ValidationError({"inventory": "Inventory is required."})
        self._validate_inventory_belongs_to_user(inventory)

        if area is None:
            raise serializers.ValidationError({"area": "Area is required."})
        self._validate_same_inventory("area", area, inventory)

        if shelf is not None:
            self._validate_same_inventory("shelf", shelf, inventory)
            if shelf.area_id != area.id:
                raise serializers.ValidationError({"shelf": "Shelf must belong to the selected area."})

        if parent_chest is not None:
            self._validate_same_inventory("parent_chest", parent_chest, inventory)
            if parent_chest.area_id != area.id:
                raise serializers.ValidationError(
                    {"parent_chest": "Parent chest must belong to the selected area."}
                )

        return attrs


class ArticleCategorySerializer(InventoryScopedSerializer):
    class Meta:
        model = ArticleCategory
        fields = ("uuid", "identifier", "inventory", "created_at", "updated_at", "name")
        read_only_fields = ("uuid", "identifier", "created_at", "updated_at")

    def validate(self, attrs):
        inventory = attrs.get("inventory") or getattr(self.instance, "inventory", None)
        if inventory is None:
            raise serializers.ValidationError({"inventory": "Inventory is required."})
        self._validate_inventory_belongs_to_user(inventory)
        return attrs


class ArticleSerializer(InventoryScopedSerializer):
    area = serializers.PrimaryKeyRelatedField(queryset=Area.objects.none(), required=False, allow_null=True)
    shelf = serializers.PrimaryKeyRelatedField(queryset=Shelf.objects.none(), required=False, allow_null=True)
    chest = serializers.PrimaryKeyRelatedField(queryset=Chest.objects.none(), required=False, allow_null=True)
    category = serializers.PrimaryKeyRelatedField(
        queryset=ArticleCategory.objects.none(), required=False, allow_null=True
    )

    class Meta:
        model = Article
        fields = (            "uuid",
            "identifier",
            "inventory",
            "created_at",
            "updated_at",
            "name",
            "description",
            "area",
            "shelf",
            "chest",
            "quantity",
            "minimum_quantity",
            "image",
            "icon",
            "category",
        )
        read_only_fields = ("uuid", "identifier", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["area"].queryset = self._inventory_queryset(Area)
        self.fields["shelf"].queryset = self._inventory_queryset(Shelf)
        self.fields["chest"].queryset = self._inventory_queryset(Chest)
        self.fields["category"].queryset = self._inventory_queryset(ArticleCategory)

    def validate(self, attrs):
        inventory = attrs.get("inventory") or getattr(self.instance, "inventory", None)
        area = attrs.get("area") if "area" in attrs else getattr(self.instance, "area", None)
        shelf = attrs.get("shelf") if "shelf" in attrs else getattr(self.instance, "shelf", None)
        chest = attrs.get("chest") if "chest" in attrs else getattr(self.instance, "chest", None)
        category = attrs.get("category") if "category" in attrs else getattr(self.instance, "category", None)

        if inventory is None:
            raise serializers.ValidationError({"inventory": "Inventory is required."})
        self._validate_inventory_belongs_to_user(inventory)

        if area is not None:
            self._validate_same_inventory("area", area, inventory)

        if shelf is not None:
            self._validate_same_inventory("shelf", shelf, inventory)
            if area is not None and shelf.area_id != area.id:
                raise serializers.ValidationError({"shelf": "Shelf must belong to the selected area."})

        if chest is not None:
            self._validate_same_inventory("chest", chest, inventory)
            if area is not None and chest.area_id != area.id:
                raise serializers.ValidationError({"chest": "Chest must belong to the selected area."})
            if shelf is not None and chest.shelf_id is not None and chest.shelf_id != shelf.id:
                raise serializers.ValidationError({"chest": "Chest must belong to the selected shelf."})

        if category is not None:
            self._validate_same_inventory("category", category, inventory)

        return attrs
