from django.contrib.auth import password_validation
from rest_framework import serializers

from .models import CustomUser, InstanceSettings
from .services import create_user_inventory


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ('uuid', 'username', 'email', 'name', 'is_superuser', 'require_reset')


class AdminUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=False, min_length=8)

    class Meta:
        model = CustomUser
        fields = ('uuid', 'username', 'email', 'name', 'is_superuser', 'require_reset', 'password')
        read_only_fields = ('uuid', 'require_reset')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if not InstanceSettings.get_solo().allow_email_login:
            self.fields.pop('email', None)

    def validate_password(self, value):
        password_validation.validate_password(value)
        return value

    def validate_email(self, value):
        if not value:
            return None

        queryset = CustomUser.objects.filter(email__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError('A user with that email already exists.')
        return value

    def validate_username(self, value):
        queryset = CustomUser.objects.filter(username__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError('A user with that username already exists.')
        return value

    def create(self, validated_data):
        password = validated_data.pop('password')
        validated_data.setdefault('email', None)
        user = CustomUser.objects.create_user(password=password, **validated_data)
        user.require_reset = True
        user.save(update_fields=['require_reset'])
        create_user_inventory(user)
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        is_superuser = validated_data.pop('is_superuser', instance.is_superuser)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.is_superuser = is_superuser
        instance.is_staff = is_superuser
        if password:
            instance.set_password(password)
            instance.require_reset = True
        instance.save()
        return instance


class SignupSerializer(serializers.ModelSerializer):
    """Validiert die Eingabe und erstellt den User"""
    password = serializers.CharField(write_only=True)

    class Meta:
        model = CustomUser
        fields = ('username', 'email', 'name', 'password')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if not InstanceSettings.get_solo().allow_email_login:
            self.fields.pop('email', None)

    def validate_password(self, value):
        password_validation.validate_password(value)
        return value

    def create(self, validated_data):
        validated_data.setdefault('email', None)
        user = CustomUser.objects.create_user(**validated_data)

        create_user_inventory(user)
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