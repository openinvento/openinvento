from django.contrib.auth import password_validation
from rest_framework import serializers

from inventory.models import Inventory

from .models import CustomUser, InstanceSettings


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ('uuid', 'username', 'email', 'name', 'is_superuser', 'require_reset')


class SignupSerializer(serializers.ModelSerializer):
    """Validiert die Eingabe und erstellt den User"""
    password = serializers.CharField(write_only=True)

    class Meta:
        model = CustomUser
        fields = ('username', 'email', 'name', 'password')

    def validate_password(self, value):
        password_validation.validate_password(value)
        return value

    def create(self, validated_data):
        user = CustomUser.objects.create_user(**validated_data)

        # Create a new inventory for the user and assign it
        inventory = Inventory.objects.create(name=f"{user.username}'s Inventory")
        user.inventories.add(inventory)
        return user


class CredentialResetSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)

    def validate_username(self, value):
        user = self.context['request'].user
        if CustomUser.objects.exclude(pk=user.pk).filter(username=value).exists():
            raise serializers.ValidationError('A user with that username already exists.')
        return value

    def validate_password(self, value):
        password_validation.validate_password(value, self.context['request'].user)
        return value

    def save(self, **kwargs):
        user = self.context['request'].user
        user.username = self.validated_data['username']
        user.set_password(self.validated_data['password'])
        user.require_reset = False
        user.save(update_fields=['username', 'password', 'require_reset'])
        return user


class InstanceSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstanceSettings
        fields = ('allow_email_login',)