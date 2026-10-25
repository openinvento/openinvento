from rest_framework import serializers

from inventory.models import Inventory

from .models import ThirdPartyProvider
from .catalog import get_provider_configuration


class ThirdPartyProviderSerializer(serializers.ModelSerializer):
    provider = serializers.CharField(max_length=40)
    type = serializers.CharField(max_length=40)
    api_key = serializers.CharField(write_only=True, required=False, allow_blank=False)
    inventory = serializers.PrimaryKeyRelatedField(queryset=Inventory.objects.none())
    has_api_key = serializers.SerializerMethodField()

    class Meta:
        model = ThirdPartyProvider
        fields = ("uuid", "inventory", "provider", "type", "name", "api_key", "has_api_key", "created_at", "updated_at")
        read_only_fields = ("uuid", "has_api_key", "created_at", "updated_at")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        self.fields["inventory"].queryset = request.user.inventories.all() if request and request.user.is_authenticated else Inventory.objects.none()

    def get_has_api_key(self, obj):
        return bool(obj.api_key)

    def validate(self, attrs):
        provider = attrs.get("provider", getattr(self.instance, "provider", None))
        provider_type = attrs.get("type", getattr(self.instance, "type", None))
        configuration = get_provider_configuration(provider, provider_type)
        if configuration is None:
            raise serializers.ValidationError({"provider": "This provider configuration is not available."})
        key_value = attrs.get("api_key", None)
        has_existing_key = self.instance is not None and bool(self.instance.encrypted_api_key)
        if configuration["requires_api_key"] and not (key_value or has_existing_key):
            raise serializers.ValidationError({"api_key": "An API key is required."})
        if self.instance is not None and "inventory" in attrs and attrs["inventory"].pk != self.instance.inventory_id:
            raise serializers.ValidationError({"inventory": "A provider cannot be moved to another inventory."})
        return attrs

    def create(self, validated_data):
        api_key = validated_data.pop("api_key", "")
        instance = ThirdPartyProvider(**validated_data)
        instance.api_key = api_key
        instance.save()
        return instance

    def update(self, instance, validated_data):
        api_key = validated_data.pop("api_key", None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        if api_key is not None:
            instance.api_key = api_key
        instance.save()
        return instance
