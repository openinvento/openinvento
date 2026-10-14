import uuid

from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models


class CustomUserManager(UserManager):
    @classmethod
    def normalize_email(cls, email):
        # Django's BaseUserManager.normalize_email() converts None to ''.
        # Preserve NULL for this nullable, unique field.
        normalized_email = super().normalize_email(email)
        return normalized_email or None


class CustomUser(AbstractUser):
    objects = CustomUserManager()

    uuid = models.UUIDField(null=False, blank=False, default=uuid.uuid4, unique=True)
    email = models.EmailField(unique=True, blank=True, null=True, default=None) # Depends on email login is enabled/ disabled
    password = models.CharField(max_length=300)
    name = models.CharField(max_length=35)
    require_reset = models.BooleanField(default=False) # For example used for init admin account
    inventories = models.ManyToManyField('inventory.Inventory', blank=True, related_name='users')
    last_login = models.DateTimeField(null=True, blank=True)
    is_superuser = models.BooleanField(default=False)


class InstanceSettings(models.Model):
    allow_email_login = models.BooleanField(default=False)

    @classmethod
    def get_solo(cls):
        settings, _ = cls.objects.get_or_create(pk=1)
        return settings
