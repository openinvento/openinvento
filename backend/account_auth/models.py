from django.db import models
import uuid
from django.contrib.auth.models import AbstractUser 


class CustomUser(AbstractUser):
    uuid = models.UUIDField(null=False, blank=False, default=uuid.uuid4, unique=True)
    email = models.EmailField(unique=True, blank=True)
    password = models.CharField(max_length=300)
    name = models.CharField(max_length=35)
    inventories = models.ManyToManyField('Inventory', blank=True, related_name='users')
    last_login = models.DateTimeField(null=True, blank=True)
    is_superuser = models.BooleanField(default=False)
