import uuid

from django.contrib.auth.models import AbstractUser, UserManager
from django.db import models
from django.db.models import Q
from rest_framework_api_key.models import AbstractAPIKey


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


class OIDCIdentity(models.Model):
    """Links a user to an account at the OpenID provider.

    OpenID Connect Core 1.0 (section 5.7) only guarantees that issuer + subject
    identify an end user; the email address may change or be reassigned.
    """
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="oidc_identities")
    issuer = models.CharField(max_length=255)
    subject = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = (
            models.UniqueConstraint(fields=("issuer", "subject"), name="unique_oidc_identity"),
        )

    def __str__(self):
        return f"{self.issuer} {self.subject} ({self.user})"


class UserAPIKey(AbstractAPIKey):
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="api_keys")


class InstanceSettings(models.Model):
    allow_email_login = models.BooleanField(default=False)
    enabled_modules = models.JSONField(default=list, blank=True)

    @classmethod
    def get_solo(cls):
        from django.conf import settings as django_settings

        defaults = {
            "enabled_modules": [module.name for module in getattr(django_settings, "DEFAULT_ENABLED_MODULES", ())]
        }
        settings, _ = cls.objects.get_or_create(pk=1, defaults=defaults)
        return settings


class Notification(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.ForeignKey(CustomUser, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=40)
    title = models.CharField(max_length=160)
    message = models.TextField(blank=True)
    link = models.CharField(max_length=300, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    source_key = models.CharField(max_length=255, blank=True)
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        constraints = (
            models.UniqueConstraint(
                fields=("user", "source_key"),
                condition=Q(source_key__gt=""),
                name="unique_notification_source_per_user",
            ),
        )

    def __str__(self):
        return f"{self.title} ({self.user})"
