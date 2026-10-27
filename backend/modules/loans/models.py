from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


class Loan(models.Model):
    """A record of an inventory article or box being borrowed by a user."""

    entry = models.ForeignKey(
        "inventory.InventoryEntry",
        on_delete=models.CASCADE,
        related_name="loans",
    )
    lent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="issued_loans",
    )
    quantity = models.PositiveIntegerField(default=1)
    lent_at = models.DateTimeField(default=timezone.now)
    due_at = models.DateTimeField(null=True, blank=True)
    returned_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ("-lent_at",)
        constraints = ()

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def clean(self):
        super().clean()
        if self.entry_id and self.entry.type not in {"article", "box"}:
            raise ValidationError({"entry": "Only articles and boxes can be loaned."})

    @property
    def is_returned(self):
        return self.returned_at is not None

    def __str__(self):
        return f"{self.entry} lent by {self.lent_by}"
