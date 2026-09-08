from django.contrib.auth import password_validation
from rest_framework import serializers

from inventory.models import Inventory

from .models import CustomUser


class UserSerializer(serializers.ModelSerializer):
    """Für die Ausgabe von User-Daten (_user_payload Replacement)"""
    class Meta:
        model = CustomUser
        fields = ('uuid', 'username', 'email', 'name', 'is_superuser')


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