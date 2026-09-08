from django.test import TestCase
from rest_framework.test import APIClient

from inventory.models import Inventory

from .models import CustomUser


class SignupInventoryTests(TestCase):
	def test_signup_creates_and_assigns_one_inventory(self):
		response = APIClient().post(
			'/api/signup/',
			{
				'username': 'newuser',
				'email': 'newuser@example.com',
				'name': 'New User',
				'password': 'StrongPassword!123',
			},
			format='json',
		)

		self.assertEqual(response.status_code, 201)
		user = CustomUser.objects.get(username='newuser')
		self.assertEqual(Inventory.objects.count(), 1)
		self.assertEqual(user.inventories.count(), 1)
		self.assertEqual(user.inventories.get().name, "newuser's Inventory")
