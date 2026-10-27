from rest_framework import serializers

from inventory.models import InventoryEntry

from .models import Loan


class LoanSerializer(serializers.ModelSerializer):
    entry = serializers.PrimaryKeyRelatedField(queryset=InventoryEntry.objects.none())
    entry_name = serializers.CharField(source="entry.name", read_only=True)
    entry_type = serializers.CharField(source="entry.type", read_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request is not None and request.user.is_authenticated:
            self.fields["entry"].queryset = InventoryEntry.objects.filter(inventory__users=request.user)

    def validate_entry(self, entry):
        if entry.type.key not in {"article", "box"}:
            raise serializers.ValidationError("Only articles and boxes can be loaned.")
        return entry

    class Meta:
        model = Loan
        fields = ("id", "entry", "entry_name", "entry_type", "lent_by", "quantity", "lent_at", "due_at", "returned_at", "notes")
        read_only_fields = ("id", "lent_by", "lent_at", "returned_at", "entry_name", "entry_type")
