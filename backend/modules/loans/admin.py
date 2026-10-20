from django.contrib import admin

from .models import Loan


@admin.register(Loan)
class LoanAdmin(admin.ModelAdmin):
    list_display = ("article", "box", "quantity", "lent_at", "due_at", "returned_at")
    list_filter = ("lent_at", "due_at", "returned_at")
    search_fields = ("article__name", "box__name", "lent_by__username", "lent_by__email")
