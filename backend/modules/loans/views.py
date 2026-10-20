from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

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

    @action(detail=True, methods=("post",), url_path="return")
    def return_loan(self, request, pk=None):
        loan = self.get_object()
        if loan.returned_at is None:
            loan.returned_at = timezone.now()
            loan.save(update_fields=("returned_at",))
        return Response(LoanSerializer(loan, context={"request": request}).data)
