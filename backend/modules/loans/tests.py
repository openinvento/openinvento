from django.core.exceptions import ValidationError
from django.test import TestCase
from rest_framework.test import APIClient

from account_auth.models import CustomUser
from inventory.models import Inventory, InventoryEntry

from .models import Loan


class LoanAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = CustomUser.objects.create_user(
            username="loan-recorder", password="password"
        )
        self.other_user = CustomUser.objects.create_user(
            username="other-recorder", password="password"
        )
        self.inventory = Inventory.objects.create(name="Loan inventory")
        self.inventory.users.add(self.user, self.other_user)
        self.area = InventoryEntry.objects.create(name="Storage", inventory=self.inventory, type="area")
        self.shelf = InventoryEntry.objects.create(name="Main shelf", parent=self.area, inventory=self.inventory, type="shelf")
        self.article = InventoryEntry.objects.create(name="Projector", inventory=self.inventory, parent=self.area, type="article")
        self.box = InventoryEntry.objects.create(name="Equipment box", parent=self.shelf, inventory=self.inventory, type="box")
        self.client.force_authenticate(user=self.user)

    def test_create_article_loan_without_borrower(self):
        response = self.client.post(
            "/api/loans/",
            {
                "entry": str(self.article.uuid),
                "quantity": 2,
                "notes": "External event",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertNotIn("borrower", response.data)
        loan = Loan.objects.get()
        self.assertEqual(loan.entry, self.article)
        self.assertEqual(loan.quantity, 2)
        self.assertEqual(loan.lent_by, self.user)
        self.assertEqual(response.data["notes"], "External event")

    def test_create_box_loan(self):
        response = self.client.post(
            "/api/loans/", {"entry": str(self.box.uuid)}, format="json"
        )

        self.assertEqual(response.status_code, 201, response.data)
        loan = Loan.objects.get()
        self.assertEqual(loan.entry, self.box)

    def test_model_rejects_area_and_shelf_loans(self):
        for entry in (self.area, self.shelf):
            with self.subTest(entry=entry.type), self.assertRaises(ValidationError):
                Loan.objects.create(entry=entry, lent_by=self.user)

    def test_model_allows_article_and_box_loans(self):
        Loan.objects.create(entry=self.article, lent_by=self.user)
        Loan.objects.create(entry=self.box, lent_by=self.user)

        self.assertEqual(Loan.objects.count(), 2)

    def test_create_rejects_missing_or_multiple_items(self):
        for payload in (
            {},
            {"entry": str(self.area.uuid)},
        ):
            with self.subTest(payload=payload):
                response = self.client.post("/api/loans/", payload, format="json")
                self.assertEqual(response.status_code, 400)

    def test_loan_history_is_scoped_to_recorder(self):
        own_loan = Loan.objects.create(entry=self.article, lent_by=self.user)
        Loan.objects.create(entry=self.box, lent_by=self.other_user)

        response = self.client.get("/api/loans/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data], [own_loan.id])

    def test_loan_history_excludes_entries_from_inaccessible_inventories(self):
        inaccessible_inventory = Inventory.objects.create(name="Inaccessible inventory")
        inaccessible_article = InventoryEntry.objects.create(
            name="Hidden projector",
            inventory=inaccessible_inventory,
            type="article",
        )
        hidden_loan = Loan.objects.create(entry=inaccessible_article, lent_by=self.user)

        response = self.client.get("/api/loans/")

        self.assertEqual(response.status_code, 200)
        self.assertNotIn(hidden_loan.id, [item["id"] for item in response.data])

    def test_mark_loan_returned(self):
        loan = Loan.objects.create(entry=self.article, lent_by=self.user)

        response = self.client.post(f"/api/loans/{loan.id}/return/", format="json")

        self.assertEqual(response.status_code, 200, response.data)
        loan.refresh_from_db()
        self.assertIsNotNone(loan.returned_at)
        self.assertIsNotNone(response.data["returned_at"])

    def test_user_cannot_return_another_recorders_loan(self):
        loan = Loan.objects.create(entry=self.article, lent_by=self.other_user)

        response = self.client.post(f"/api/loans/{loan.id}/return/", format="json")

        self.assertEqual(response.status_code, 404)
        loan.refresh_from_db()
        self.assertIsNone(loan.returned_at)

    def test_loan_endpoints_require_authentication(self):
        self.client.force_authenticate(user=None)

        self.assertEqual(self.client.get("/api/loans/").status_code, 403)
