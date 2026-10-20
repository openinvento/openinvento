from django.conf import settings
from django.db import models
from django.utils import timezone


class Loan(models.Model):
    """A record of an inventory article or chest being borrowed by a user."""

    article = models.ForeignKey(
        "inventory.Article",
        on_delete=models.PROTECT,
        related_name="loans",
        null=True,
        blank=True,
    )
    # You can also loan a chest
    chest = models.ForeignKey(
        "inventory.Chest",
        on_delete=models.PROTECT,
        related_name="loans",
        null=True,
        blank=True,
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
        constraints = (
            models.CheckConstraint(
                condition=(
                    models.Q(article__isnull=False, chest__isnull=True)
                    | models.Q(article__isnull=True, chest__isnull=False)
                ),
                name="loan_exactly_one_item",
            ),
        )

    @property
    def is_returned(self):
        return self.returned_at is not None

    def __str__(self):
        item = self.article or self.chest
        return f"{item} lent by {self.lent_by}"
