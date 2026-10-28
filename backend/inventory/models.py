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

INVENTORY_ENTRY_TYPE_CONFIG = {
    "area": {
        "name": "Area",
        "allowed_parent_types": [],
        "allowed_child_types": ["shelf", "box", "article"],
        "allow_root": True, # Areas can be root entries in the inventory tree
    },
    "shelf": {
        "name": "Shelf",
        "allowed_parent_types": ["area"],
        "allowed_child_types": ["box", "article"],
        "allow_root": False,
    },
    "box": {
        "name": "Box",
        "allowed_parent_types": ["area", "shelf", "box"],
        "allowed_child_types": ["box", "article"],
        "allow_root": False,
    },
    "article": {
        "name": "Article",
        "allowed_parent_types": ["area", "shelf", "box", "article"],
        "allowed_child_types": ["article"],
        "allow_root": True,
    },
}


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
    ext = os.path.splitext(value.name)[1].lower()
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
    return os.path.join("article-attachments", str(instance.entry.uuid), f"{uuid.uuid4()}-{safe_name}{file_ext}")

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
    Base class for inventory metadata components such as categories and category fields.
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


class InventoryEntryType(models.TextChoices):
    # Use it as InventoryEntry.type.AREA for example
    # AREA = "area"
    # AREA.label = "Area"
    AREA = "area", "Area"
    SHELF = "shelf", "Shelf"
    BOX = "box", "Box"
    ARTICLE = "article", "Article"


class InventoryEntry(models.Model):
    """A physical place or an article, stored in the inventory tree."""
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, primary_key=True, editable=False)
    identifier = models.CharField(max_length=30, blank=True)
    inventory = models.ForeignKey(Inventory, on_delete=models.CASCADE, related_name="entries")
    name = models.CharField(max_length=255)
    type = models.CharField(max_length=20, choices=InventoryEntryType.choices)
    parent = models.ForeignKey("self", on_delete=models.CASCADE, null=True, blank=True, related_name="children")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    description = models.CharField(blank=True, null=True, max_length=750)
    quantity = models.IntegerField(default=1)
    stock_tracking = models.BooleanField(default=False)
    image = models.ImageField(null=True, blank=True, upload_to=article_image_upload_path, validators=[
        FileExtensionValidator(allowed_extensions=["jpg", "jpeg", "png"]), validate_file_size, validate_pure_image
    ])
    icon = models.CharField(max_length=40, blank=True, null=True)
    category = models.ForeignKey("ArticleCategory", on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        ordering = ("name",)
        constraints = (
            models.UniqueConstraint(
                fields=("identifier", "inventory"),
                name="unique_inventory_entry_identifier",
            ),
        )
    
    def save(self, *args, **kwargs):
        if not self.identifier:
            self.identifier = generate_random_code()
        update_fields = kwargs.get("update_fields")
        if self._state.adding:
            self.full_clean()
        elif update_fields is not None:
            changed_fields = set(update_fields)
            if changed_fields & {"inventory", "type", "parent", "category", "image"}:
                self.full_clean(exclude=[] if "image" in changed_fields else ["image"])
        super().save(*args, **kwargs)

    def clean(self):
        """ Validate that the parent and category belong to the same inventory and that the parent-child relationship is valid."""
        super().clean()
        if self.type not in INVENTORY_ENTRY_TYPE_CONFIG:
            raise ValidationError({"type": f"Invalid entry type: {self.type}"})
        if self.parent_id:
            if self.parent.inventory_id != self.inventory_id:
                raise ValidationError({"parent": "Parent must belong to the same inventory."})
            type_config = INVENTORY_ENTRY_TYPE_CONFIG[self.type]
            parent_config = INVENTORY_ENTRY_TYPE_CONFIG[self.parent.type]
            if (self.parent.type not in type_config["allowed_parent_types"]
                    or self.type not in parent_config["allowed_child_types"]):
                raise ValidationError({"parent": "This parent type is not allowed for this entry."})
            node = self.parent
            seen = set()
            while node is not None:
                if node.pk == self.pk or node.pk in seen:
                    raise ValidationError({"parent": "An entry cannot be its own ancestor."})
                seen.add(node.pk)
                node = node.parent
        elif not INVENTORY_ENTRY_TYPE_CONFIG[self.type]["allow_root"]:
            raise ValidationError({"parent": "This entry type requires a parent."})
        if self.category_id and self.category.inventory_id != self.inventory_id:
            raise ValidationError({"category": "Category must belong to the same inventory."})

    def __str__(self):
        return self.name


class ArticleAttachment(models.Model):
    entry = models.ForeignKey(InventoryEntry, on_delete=models.CASCADE, related_name="attachments")
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


@receiver(pre_delete, sender=InventoryEntry)
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
    entry = models.ForeignKey(InventoryEntry, on_delete=models.CASCADE, related_name="field_values")
    field = models.ForeignKey(CategoryField, on_delete=models.CASCADE, related_name="article_values")
    value = models.JSONField(default=None, blank=True, null=True)
    notify_on_date = models.BooleanField(default=False)

    class Meta:
        constraints = (
            models.UniqueConstraint(
                fields=("entry", "field"),
                name="unique_entry_field_value",
            ),
        )

    def __str__(self):
        return f"{self.entry}: {self.field.label}"
