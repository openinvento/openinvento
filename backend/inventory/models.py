from django.db import models
import uuid
import os
import secrets
import string
from django.core.validators import FileExtensionValidator, MaxValueValidator
from django.core.exceptions import ValidationError
from django.conf import settings

def validate_file_size(value):
    if value.size > settings.MAX_FILE_SIZE:
        raise ValidationError(f"Die Datei darf maximal {settings.MAX_FILE_SIZE / (1024 * 1024)} MB groß sein.")

def article_image_upload_path(instance, filename):
    file_ext = os.path.splitext(filename)[1]
    new_filename = f"{uuid.uuid4()}{file_ext}"  
    return os.path.join("articles", new_filename)

def generate_random_code(length=10):
    characters = string.ascii_letters + string.digits
    return ''.join(secrets.choice(characters) for _ in range(length))

class Inventory(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, primary_key=True, editable=False)
    name = models.CharField(max_length=100)
    identifier = models.CharField(unique=True, max_length=30, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Inventories"

    def save(self, *args, **kwargs):
        if not self.identifier:
            self.identifier = generate_random_code()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class InventoryComponent(models.Model):
    """
    Base class for all components of the inventory (Area, Shelf, Chest, Article, ArticleCategory).
    """
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, primary_key=True, editable=False)
    identifier = models.CharField(max_length=30, blank=True)
    inventory = models.ForeignKey(Inventory, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

    def save(self, *args, **kwargs):
        if not self.identifier:
            self.identifier = generate_random_code()
        super().save(*args, **kwargs)

class Area(InventoryComponent):
    name = models.CharField(max_length=100)

    def __str__(self):
        return f"Area: {self.name} ({self.inventory.name})"

class Shelf(InventoryComponent):
    name = models.CharField(max_length=100)
    area = models.ForeignKey(Area, on_delete=models.CASCADE, related_name="shelves")

    def __str__(self):
        return f"Shelf: {self.name} -> {self.area.name}"

class Chest(InventoryComponent):
    name = models.CharField(max_length=100)
    area = models.ForeignKey(Area, on_delete=models.CASCADE, related_name="chests")
    shelf = models.ForeignKey(Shelf, on_delete=models.CASCADE, null=True, blank=True, related_name='chests')
    parent_chest = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='sub_chests')

    def __str__(self):
        return self.name

class Article(InventoryComponent):
    name = models.CharField(max_length=250)
    description = models.CharField(blank=True, null=True, max_length=750)
    
    area = models.ForeignKey(Area, on_delete=models.CASCADE, null=True, blank=True)
    shelf = models.ForeignKey(Shelf, on_delete=models.CASCADE, null=True, blank=True)
    chest = models.ForeignKey(Chest, on_delete=models.SET_NULL, null=True, blank=True, related_name='contained_articles')
    
    quantity = models.IntegerField(default=1)
    minimum_quantity = models.IntegerField(null=True, blank=True, validators=[MaxValueValidator(9999)])
    
    image = models.ImageField(
        null=True, 
        blank=True, 
        upload_to=article_image_upload_path, 
        validators=[FileExtensionValidator(allowed_extensions=["jpg", "jpeg", "png"]), validate_file_size]
    )
    icon = models.CharField(max_length=40, blank=True, null=True)
    category = models.ForeignKey('ArticleCategory', on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.quantity}x)"

class ArticleCategory(InventoryComponent):
    name = models.CharField(max_length=100)

    class Meta:
        verbose_name_plural = "Article Categories"
