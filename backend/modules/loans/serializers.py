from inventory.models import Article, Chest
from rest_framework import serializers

from .models import Loan


class LoanSerializer(serializers.ModelSerializer):
    article = serializers.PrimaryKeyRelatedField(
        queryset=Article.objects.none(), required=False, allow_null=True
    )
    chest = serializers.PrimaryKeyRelatedField(
        queryset=Chest.objects.none(), required=False, allow_null=True
    )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        request = self.context.get("request")
        if request is not None and request.user.is_authenticated:
            self.fields["article"].queryset = Article.objects.filter(
                inventory__users=request.user
            )
            self.fields["chest"].queryset = Chest.objects.filter(
                inventory__users=request.user
            )

    def validate(self, attrs):
        article = attrs.get("article", getattr(self.instance, "article", None))
        chest = attrs.get("chest", getattr(self.instance, "chest", None))
        if (article is None) == (chest is None):
            raise serializers.ValidationError(
                "Select exactly one of article or chest."
            )
        return attrs

    class Meta:
        model = Loan
        fields = (
            "id",
            "article",
            "chest",
            "lent_by",
            "quantity",
            "lent_at",
            "due_at",
            "returned_at",
            "notes",
        )
        read_only_fields = ("id", "lent_by", "lent_at", "returned_at")
