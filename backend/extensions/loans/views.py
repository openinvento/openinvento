from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Loan
from .serializers import LoanSerializer


class LoanViewSet(viewsets.ModelViewSet):
    serializer_class = LoanSerializer
    permission_classes = (IsAuthenticated,)

    def get_queryset(self):
        return Loan.objects.filter(borrower=self.request.user).select_related(
            "article", "chest", "borrower", "lent_by"
        )

    def perform_create(self, serializer):
        serializer.save(borrower=self.request.user, lent_by=self.request.user)
