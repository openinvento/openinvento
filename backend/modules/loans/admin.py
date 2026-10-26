from django.contrib import admin

from .models import Loan


@admin.register(Loan)
class LoanAdmin(admin.ModelAdmin):
    list_display = ("entry", "entry_type", "quantity", "lent_at", "due_at", "returned_at")
    list_filter = ("lent_at", "due_at", "returned_at")
    search_fields = ("entry__name", "lent_by__username", "lent_by__email")

    @admin.display(description="Entry type")
    def entry_type(self, loan):
        return loan.entry.type.name
