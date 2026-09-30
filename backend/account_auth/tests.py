import os
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase
from inventory.models import Inventory
from rest_framework.test import APIClient

from .models import CustomUser, InstanceSettings


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


class InitialAdminCommandTests(TestCase):
	@patch.dict(os.environ, {
		'INIT_ADMIN_USERNAME': 'initial-admin',
		'INIT_ADMIN_PASSWORD': 'StrongPassword!123',
		'CREATE_INIT_ADMIN': 'true',
	}, clear=False)
	def test_creates_initial_admin_with_reset_required(self):
		call_command('create_initial_admin')

		user = CustomUser.objects.get(username='initial-admin')
		self.assertTrue(user.is_superuser)
		self.assertTrue(user.is_staff)
		self.assertTrue(user.require_reset)
		self.assertTrue(user.check_password('StrongPassword!123'))
		self.assertEqual(user.inventories.count(), 1)
		self.assertEqual(user.inventories.get().name, "initial-admin's Inventory")

	@patch.dict(os.environ, {
		'INIT_ADMIN_USERNAME': 'initial-admin',
		'INIT_ADMIN_PASSWORD': 'StrongPassword!123',
		'CREATE_INIT_ADMIN': 'true',
	}, clear=False)
	def test_does_not_create_second_admin(self):
		CustomUser.objects.create_user(username='existing', password='StrongPassword!123')

		call_command('create_initial_admin')

		self.assertEqual(CustomUser.objects.count(), 1)

	@patch.dict(os.environ, {'CREATE_INIT_ADMIN': 'false'}, clear=False)
	def test_can_disable_initial_admin_creation(self):
		call_command('create_initial_admin')

		self.assertFalse(CustomUser.objects.exists())

	@patch.dict(os.environ, {'CREATE_INIT_ADMIN': 'true'}, clear=False)
	def test_requires_initial_admin_credentials(self):
		with patch.dict(os.environ, {}, clear=False):
			os.environ.pop('INIT_ADMIN_USERNAME', None)
			os.environ.pop('INIT_ADMIN_PASSWORD', None)
			with self.assertRaises(CommandError):
				call_command('create_initial_admin')


class EmailLoginSettingTests(TestCase):
	def test_email_login_is_disabled_by_default(self):
		user = CustomUser.objects.create_user(
			username='login-user',
			email='login@example.com',
			password='StrongPassword!123',
		)

		response = self.client.post('/api/login/', {
			'identifier': user.email,
			'password': 'StrongPassword!123',
		}, content_type='application/json')

		self.assertEqual(response.status_code, 403)

	def test_admin_can_enable_email_login(self):
		admin = CustomUser.objects.create_superuser(
			username='admin', password='StrongPassword!123', name='Admin',
		)
		self.client.force_login(admin)

		response = self.client.patch('/api/instance-settings/', {
			'allow_email_login': True,
		}, content_type='application/json')

		self.assertEqual(response.status_code, 200)
		self.assertTrue(InstanceSettings.get_solo().allow_email_login)
