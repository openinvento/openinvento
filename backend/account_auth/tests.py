import os
from datetime import timedelta
from unittest.mock import patch

from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from inventory.models import Inventory, InventoryEntry

from .models import CustomUser, InstanceSettings, UserAPIKey


class SignupInventoryTests(TestCase):
	@override_settings(ENABLE_SIGNUP=True)
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

	def test_signup_is_disabled_by_default(self):
		response = APIClient().post('/api/signup/', {}, format='json')

		self.assertEqual(response.status_code, 403)


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


class AdminUserManagementTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.admin = CustomUser.objects.create_superuser(
			username='admin', email='admin@example.com', password='StrongPassword!123', name='Admin',
		)
		self.client.force_login(self.admin)

	def test_non_admin_cannot_list_users(self):
		self.client.force_login(CustomUser.objects.create_user(
			username='member', password='StrongPassword!123', name='Member',
		))

		response = self.client.get('/api/users/')

		self.assertEqual(response.status_code, 403)

	def test_admin_can_create_user_and_inventory(self):
		response = self.client.post('/api/users/', {
			'username': 'new-user',
			'email': 'new-user@example.com',
			'name': 'New User',
			'password': 'StrongPassword!123',
		}, format='json')

		self.assertEqual(response.status_code, 201)
		user = CustomUser.objects.get(username='new-user')
		self.assertTrue(user.require_reset)
		self.assertEqual(user.inventories.count(), 1)

	def test_admin_create_returns_password_validation_error(self):
		response = self.client.post('/api/users/', {
			'username': 'short-password-user',
			'name': 'Short Password User',
			'password': 'short',
		}, format='json')

		self.assertEqual(response.status_code, 400)
		self.assertIn('password', response.data)

	def test_email_is_ignored_when_email_login_is_disabled(self):
		first_response = self.client.post('/api/users/', {
			'username': 'no-email-user',
			'email': 'not-an-email',
			'name': 'No Email User',
			'password': 'StrongPassword!123',
		}, format='json')
		second_response = self.client.post('/api/users/', {
			'username': 'another-no-email-user',
			'name': 'Another No Email User',
			'password': 'StrongPassword!123',
		}, format='json')

		self.assertEqual(first_response.status_code, 201)
		self.assertEqual(second_response.status_code, 201)
		user = CustomUser.objects.get(username='no-email-user')
		self.assertIsNone(user.email)
		self.assertNotIn('email', first_response.data)

	def test_admin_cannot_delete_or_demote_last_admin(self):
		delete_response = self.client.delete(f'/api/users/{self.admin.uuid}/')
		demote_response = self.client.patch(
			f'/api/users/{self.admin.uuid}/', {'is_superuser': False}, format='json',
		)

		self.assertEqual(delete_response.status_code, 400)
		self.assertEqual(demote_response.status_code, 400)
		self.assertTrue(CustomUser.objects.filter(pk=self.admin.pk).exists())


# Tests for API key management and authentication
class APIKeyManagementTests(TestCase):
	def setUp(self):
		self.client = APIClient()
		self.user = CustomUser.objects.create_user(
			username='api-user', password='StrongPassword!123', name='API User',
		)
		self.other_user = CustomUser.objects.create_user(
			username='other-api-user', password='StrongPassword!123', name='Other User',
		)
		self.inventory = Inventory.objects.create(name='User inventory')
		self.inventory.users.add(self.user)
		self.area = InventoryEntry.objects.create(name='User area', type='area', inventory=self.inventory)
		self.other_inventory = Inventory.objects.create(name='Other inventory')
		self.other_inventory.users.add(self.other_user)
		InventoryEntry.objects.create(name='Other area', type='area', inventory=self.other_inventory)

	def create_key(self, user=None, name='automation'):
		api_key, secret = UserAPIKey.objects.create_key(name=name, user=user or self.user)
		return api_key, secret

	def authenticate_with_key(self, secret):
		self.client.credentials(HTTP_AUTHORIZATION=f'Api-Key {secret}')

	def test_authenticated_user_can_create_and_list_api_keys(self):
		self.client.force_login(self.user)
		response = self.client.post('/api/api-keys/', {'name': 'nightly sync'}, format='json')

		self.assertEqual(response.status_code, 201)
		self.assertIn('key', response.data)
		self.assertEqual(response.data['name'], 'nightly sync')
		self.assertEqual(response.data['id'], response.data['prefix'])
		self.assertNotIn('hashed_key', response.data)

		listing = self.client.get('/api/api-keys/')
		self.assertEqual(listing.status_code, 200)
		self.assertEqual(len(listing.data), 1)
		self.assertNotIn('key', listing.data[0])

	def test_api_key_can_rename_and_revoke_only_owned_key(self):
		self.client.force_login(self.user)
		api_key, _ = self.create_key()
		other_key, _ = self.create_key(user=self.other_user, name='other')

		update = self.client.patch(f'/api/api-keys/{api_key.prefix}/', {'name': 'renamed'}, format='json')
		self.assertEqual(update.status_code, 200)
		self.assertEqual(update.data['name'], 'renamed')

		forbidden_update = self.client.patch(f'/api/api-keys/{other_key.prefix}/', {'name': 'stolen'}, format='json')
		self.assertEqual(forbidden_update.status_code, 404)

		revoked = self.client.delete(f'/api/api-keys/{api_key.prefix}/')
		self.assertEqual(revoked.status_code, 204)
		api_key.refresh_from_db()
		self.assertTrue(api_key.revoked)
		self.assertFalse(UserAPIKey.objects.get(pk=other_key.pk).revoked)

	def test_api_key_authentication_scopes_inventory_access_to_owner(self):
		_, secret = self.create_key()
		self.authenticate_with_key(secret)

		response = self.client.get('/api/entries/?type=area')

		self.assertEqual(response.status_code, 200)
		self.assertEqual([area['uuid'] for area in response.data], [str(self.area.uuid)])

	def test_api_key_authentication_is_only_enabled_on_opted_in_views(self):
		_, secret = self.create_key()
		self.authenticate_with_key(secret)

		key_management_response = self.client.get('/api/api-keys/')
		self.assertEqual(key_management_response.status_code, 403)

		members_response = self.client.get(f'/api/inventories/{self.inventory.uuid}/members/')
		self.assertEqual(members_response.status_code, 403)

	def test_api_key_can_export_own_inventory(self):
		_, secret = self.create_key()
		self.authenticate_with_key(secret)

		response = self.client.get(f'/api/inventories/{self.inventory.uuid}/export/')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response['Content-Type'], 'application/zip')

	def test_api_key_cannot_export_other_inventory(self):
		_, secret = self.create_key()
		self.authenticate_with_key(secret)

		response = self.client.get(f'/api/inventories/{self.other_inventory.uuid}/export/')

		self.assertEqual(response.status_code, 404)

	def test_api_key_can_generate_code_pdf_for_own_entries(self):
		_, secret = self.create_key()
		self.authenticate_with_key(secret)

		response = self.client.post('/api/codes/pdf/', {'uuids': [str(self.area.uuid)]}, format='json')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response['Content-Type'], 'application/pdf')

	def test_api_key_cannot_generate_code_pdf_for_other_entries(self):
		_, secret = self.create_key()
		self.authenticate_with_key(secret)
		other_area = InventoryEntry.objects.get(inventory=self.other_inventory)

		response = self.client.post('/api/codes/pdf/', {'uuids': [str(other_area.uuid)]}, format='json')

		self.assertEqual(response.status_code, 400)
		self.assertEqual(response.data['uuids'], [str(other_area.uuid)])

	def test_revoked_api_key_cannot_export_or_generate_code_pdf(self):
		revoked_key, secret = self.create_key(name='revoked')
		revoked_key.revoked = True
		revoked_key.save()
		self.authenticate_with_key(secret)

		self.assertEqual(self.client.get(f'/api/inventories/{self.inventory.uuid}/export/').status_code, 401)
		self.assertEqual(self.client.post('/api/codes/pdf/', {'uuids': [str(self.area.uuid)]}, format='json').status_code, 401)

	def test_invalid_revoked_and_expired_api_keys_are_rejected(self):
		self.authenticate_with_key('invalid.key')
		invalid_response = self.client.get('/api/entries/?type=area')
		self.assertEqual(invalid_response.status_code, 401)

		revoked_key, revoked_secret = self.create_key(name='revoked')
		revoked_key.revoked = True
		revoked_key.save()
		self.authenticate_with_key(revoked_secret)
		self.assertEqual(self.client.get('/api/entries/?type=area').status_code, 401)

		_, expired_secret = UserAPIKey.objects.create_key(
			name='expired', user=self.user, expiry_date=timezone.now() - timedelta(days=1),
		)
		self.authenticate_with_key(expired_secret)
		self.assertEqual(self.client.get('/api/entries/?type=area').status_code, 401)

	def test_api_key_endpoint_requires_authentication(self):
		response = self.client.get('/api/api-keys/')
		self.assertEqual(response.status_code, 403)
