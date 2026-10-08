from django.contrib.auth import password_validation
from rest_framework import serializers

from .models import CustomUser, InstanceSettings
from .services import create_user_inventory


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomUser
        fields = ('uuid', 'username', 'email', 'name', 'is_superuser', 'require_reset')


class AdminUserSerializer(serializers.ModelSerializer):
    """ AdminUserSerializer is used for admin operations on CustomUser instances. It allows for the creation and updating of users, including setting passwords and superuser status. The serializer also handles validation for unique usernames and emails, as well as password strength requirements."""
    name = serializers.CharField(max_length=35, required=False)
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
        validated_data['email'] = validated_data.get('email') or None
        # Use the username as the default (display) name
        validated_data.setdefault('name', validated_data['username'])
        user = CustomUser.objects.create_user(password=password, **validated_data)
        if not user.email:
            user.email = None
            user.save(update_fields=['email'])
        user.require_reset = True
        user.save(update_fields=['require_reset'])
        create_user_inventory(user)
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        is_superuser = validated_data.pop('is_superuser', instance.is_superuser)
        for field, value in validated_data.items():
            if field == 'email':
                value = value or None
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
    name = serializers.CharField(max_length=35, required=False)
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
        validated_data['email'] = validated_data.get('email') or None
        validated_data.setdefault('name', validated_data['username'])
        user = CustomUser.objects.create_user(**validated_data)
        # When no email is provided, set it to None to avoid empty string issues
        if not user.email:
            user.email = None
            user.save(update_fields=['email'])

        create_user_inventory(user)
        return user


class CredentialResetSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    name = serializers.CharField(max_length=35, required=False)
    password = serializers.CharField(write_only=True, required=False, min_length=8)

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
        if 'name' in self.validated_data:
            user.name = self.validated_data['name']
        if 'password' in self.validated_data:
            user.set_password(self.validated_data['password'])
        user.require_reset = False
        update_fields = ['username', 'name', 'require_reset']
        if 'password' in self.validated_data:
            update_fields.append('password')
        user.save(update_fields=update_fields)
        return user


class InstanceSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = InstanceSettings
        fields = ('allow_email_login',)