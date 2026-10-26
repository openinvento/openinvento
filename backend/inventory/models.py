import os
import secrets
import string
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from django.db import models
from django.db.models.signals import pre_delete
from django.dispatch import receiver
from django.utils.text import slugify
from PIL import Image, UnidentifiedImageError


def validate_file_size(value):
    if value.size > settings.MAX_FILE_SIZE:
        raise ValidationError(f"Die Datei darf maximal {settings.MAX_FILE_SIZE / (1024 * 1024)} MB groß sein.")

def validate_pure_image(image_file):
    image_file.seek(0)
    try:
        with Image.open(image_file) as img:
            if img.format not in ("JPEG", "PNG"):
                raise ValidationError("Invalid image format. Only JPEG and PNG are allowed.")
            img.verify()
    except (UnidentifiedImageError, OSError, SyntaxError):
        raise ValidationError("Invalid image file.")
    finally:
        image_file.seek(0)

def validate_attachment_content(value):
    ext = os.path.splitext(value.name).lower()
    if ext in [".jpg", ".jpeg", ".png"]:
        validate_pure_image(value)


def article_image_upload_path(instance, filename):
    file_ext = os.path.splitext(os.path.basename(filename))[1].lower()
    if file_ext not in {".jpg", ".jpeg", ".png"}:
        file_ext = ".jpg"
    new_filename = f"{uuid.uuid4()}{file_ext}"  
    return os.path.join("articles", new_filename)

def article_attachment_upload_path(instance, filename):
    file_ext = os.path.splitext(os.path.basename(filename))[1].lower()
    safe_name = slugify(os.path.splitext(os.path.basename(filename))[0])[:80] or "attachment"
    return os.path.join("article-attachments", str(instance.article.uuid), f"{uuid.uuid4()}-{safe_name}{file_ext}")

def generate_random_code(length=10):
    characters = string.ascii_letters + string.digits
    return ''.join(secrets.choice(characters) for _ in range(length))

class Inventory(models.Model):
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, primary_key=True, editable=False)
    name = models.CharField(max_length=100)
    # The identifier is only used for inventory-internal identification for users - not system relevant. Users can change it any time by themselves
    identifier = models.CharField(unique=True, max_length=30, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "Inventories"

    def save(self, *args, **kwargs):
        if not self.identifier:
            self.identifier = generate_random_code()
        super().save(*args, **kwargs)
        from .category_defaults import ensure_default_categories
        ensure_default_categories(self)

    def __str__(self):
        return self.name


class InventoryComponent(models.Model):
    """
    Base class for all components of the inventory (Area, Shelf, Box, Article, ArticleCategory).
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

class Box(InventoryComponent):
    name = models.CharField(max_length=100)
    area = models.ForeignKey(Area, on_delete=models.CASCADE, related_name="boxes")
    shelf = models.ForeignKey(Shelf, on_delete=models.CASCADE, null=True, blank=True, related_name='boxes')
    parent_box = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='sub_boxes')

    def __str__(self):
        return self.name

class Article(InventoryComponent):
    name = models.CharField(max_length=100)
    description = models.CharField(blank=True, null=True, max_length=750)
    
    area = models.ForeignKey(Area, on_delete=models.CASCADE, null=True, blank=True)
    shelf = models.ForeignKey(Shelf, on_delete=models.CASCADE, null=True, blank=True)
    box = models.ForeignKey(Box, on_delete=models.SET_NULL, null=True, blank=True, related_name='contained_articles')
    
    quantity = models.IntegerField(default=1)
    stock_tracking = models.BooleanField(default=False)
    
    image = models.ImageField(
        null=True, 
        blank=True, 
        upload_to=article_image_upload_path, 
        validators=[
            FileExtensionValidator(allowed_extensions=["jpg", "jpeg", "png"]), 
            validate_file_size,
            validate_pure_image
        ]
    )
    icon = models.CharField(max_length=40, blank=True, null=True)
    category = models.ForeignKey('ArticleCategory', on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.quantity}x)"


class ArticleAttachment(models.Model):
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(
        upload_to=article_attachment_upload_path,
        validators=[
            FileExtensionValidator(allowed_extensions=["jpg", "jpeg", "png", "pdf", "doc", "docx", "odt", "txt", "rtf", "xls", "xlsx", "csv", "ppt", "pptx", "zip"]), 
            validate_file_size,
            validate_attachment_content
        ],
    )
    original_name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.original_name


@receiver(pre_delete, sender=Article)
def delete_article_image_file(sender, instance, **kwargs):
    if instance.image:
        instance.image.delete(save=False)


@receiver(pre_delete, sender=ArticleAttachment)
def delete_article_attachment_file(sender, instance, **kwargs):
    if instance.file:
        instance.file.delete(save=False)

class ArticleCategory(InventoryComponent):
    name = models.CharField(max_length=100)

    class Meta:
        verbose_name_plural = "Article Categories"


class CategoryField(InventoryComponent):
    FIELD_TYPES = (
        ("text", "Text"),
        ("number", "Number"),
        ("boolean", "Boolean"),
        ("date", "Date"),
        ("barcode", "Barcode"),
        ("select", "Select"),
    )

    key = models.SlugField(max_length=50)
    label = models.CharField(max_length=100)
    field_type = models.CharField(max_length=20, choices=FIELD_TYPES, default="text")
    options = models.JSONField(default=list, blank=True)
    # A nullable category field represents a global field ("All categories")
    category = models.ForeignKey(
        ArticleCategory,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="fields",
    )

    class Meta:
        constraints = (
            models.UniqueConstraint(
                fields=("inventory", "key", "category"),
                name="unique_category_field",
            ),
        )

    def save(self, *args, **kwargs):
        if not self.key and self.label:
            self.key = slugify(self.label)

        if self.key:
            base_key = self.key[:45]
            counter = 1
            qs = CategoryField.objects.filter(inventory=self.inventory, category=self.category)
            if self.pk:
                qs = qs.exclude(pk=self.pk)

            while qs.filter(key=self.key).exists():
                self.key = f"{base_key}-{counter}"
                counter += 1

        super().save(*args, **kwargs)

    def __str__(self):
        return self.label


class ArticleFieldValue(models.Model):
    article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name="field_values")
    field = models.ForeignKey(CategoryField, on_delete=models.CASCADE, related_name="article_values")
    value = models.JSONField(default=None, blank=True, null=True)
    notify_on_date = models.BooleanField(default=False)

    class Meta:
        constraints = (
            models.UniqueConstraint(
                fields=("article", "field"),
                name="unique_article_field_value",
            ),
        )

    def __str__(self):
        return f"{self.article}: {self.field.label}"
