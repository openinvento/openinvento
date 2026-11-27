from django.db import models


class PublicPage(models.Model):
    """An entry whose scan URL shows a public contact page to people who are not signed in.

    The row existing is the opt-in. Only the name (if show_name), the photo (if show_photo) and the
    note are ever public.
    """

    entry = models.OneToOneField(
        "inventory.InventoryEntry",
        on_delete=models.CASCADE,
        primary_key=True,
        related_name="public_page",
    )
    show_name = models.BooleanField(default=True)
    show_photo = models.BooleanField(default=False)
    allow_contact = models.BooleanField(default=True)
    # Contact hints or a reward, shown to visitors as written.
    note = models.TextField(blank=True, max_length=500)

    def __str__(self):
        return f"Public page: {self.entry}"
