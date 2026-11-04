import os
import uuid
from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, override_settings
from rest_framework.test import APIClient

from inventory.models import Inventory, InventoryEntry, is_prefix_group
from openinvento.settings_utils import group_inventories_env

from .models import CustomUser
from .oidc_groups import get_groups
from .tests_oidc import OIDCTestCase

PREFIX = 'openinvento-'
GROUP_SYNC_SETTINGS = {
	'OIDC_GROUP_SYNC': True,
	'OIDC_GROUPS_CLAIM': 'groups',
	'OIDC_INVENTORY_GROUP_PREFIX': PREFIX,
	'OIDC_GROUP_INVENTORIES': {},
	'OIDC_ALLOWED_GROUPS': [],
	'OIDC_ADMIN_GROUP': '',
}
NO_GROUP_SETTINGS = {**GROUP_SYNC_SETTINGS, 'OIDC_GROUP_SYNC': False, 'OIDC_INVENTORY_GROUP_PREFIX': ''}


class GroupInventoriesSettingTests(SimpleTestCase):
	def parse(self, value):
		with patch.dict(os.environ, {'OIDC_GROUP_INVENTORIES': value}):
			return group_inventories_env('OIDC_GROUP_INVENTORIES')

	def test_unset_is_empty(self):
		with patch.dict(os.environ, {}, clear=True):
			self.assertEqual(group_inventories_env('OIDC_GROUP_INVENTORIES'), {})

	def test_maps_groups_to_normalized_uuids(self):
		inventory = uuid.uuid4()
		mapping = self.parse(f'{{"family": "{str(inventory).upper()}", "a,b=c:d": "{uuid.uuid4().hex}"}}')

		self.assertEqual(mapping['family'], str(inventory))
		self.assertIn('a,b=c:d', mapping)

	def test_empty_value_is_empty(self):
		self.assertEqual(self.parse('  '), {})

	def test_invalid_json_stops_the_start(self):
		with self.assertRaisesMessage(ImproperlyConfigured, 'not valid JSON'):
			self.parse('{"family": ')

	def test_non_object_stops_the_start(self):
		with self.assertRaisesMessage(ImproperlyConfigured, 'must be a JSON object'):
			self.parse('["family"]')

	def test_entry_without_uuid_stops_the_start(self):
		for value in ('"not-a-uuid"', '42', 'null'):
			with self.subTest(value=value), self.assertRaisesMessage(ImproperlyConfigured, "for group 'typo'"):
				self.parse(f'{{"family": "{uuid.uuid4()}", "typo": {value}}}')

	def test_inventory_mapped_twice_stops_the_start(self):
		inventory = str(uuid.uuid4())
		with self.assertRaisesMessage(ImproperlyConfigured, 'more than one group'):
			self.parse(f'{{"family": "{inventory}", "relatives": "{inventory.upper()}"}}')

	def test_group_listed_twice_stops_the_start(self):
		with self.assertRaisesMessage(ImproperlyConfigured, "lists group 'family' more than once"):
			self.parse(f'{{"family": "{uuid.uuid4()}", "family": "{uuid.uuid4()}"}}')

@override_settings(**GROUP_SYNC_SETTINGS)
class GroupsClaimTests(SimpleTestCase):
	def test_list_of_strings(self):
		self.assertEqual(get_groups({'groups': ['a', 'b', 'a']}), {'a', 'b'})

	def test_empty_list_is_no_groups(self):
		self.assertEqual(get_groups({'groups': []}), set())

	def test_single_string_is_one_group(self):
		self.assertEqual(get_groups({'groups': 'family'}), {'family'})

	def test_missing_or_malformed_claim_is_none(self):
		for claims in ({}, {'groups': None}, {'groups': {'family': True}}, {'groups': ['family', 1]}):
			with self.subTest(claims=claims):
				self.assertIsNone(get_groups(claims))

	@override_settings(OIDC_GROUPS_CLAIM='roles')
	def test_claim_name_is_configurable(self):
		self.assertEqual(get_groups({'groups': ['a'], 'roles': ['b']}), {'b'})

	def test_prefix_alone_is_no_prefix_group(self):
		self.assertTrue(is_prefix_group('openinvento-workshop'))
		self.assertFalse(is_prefix_group('openinvento-'))
		self.assertFalse(is_prefix_group('Openinvento-workshop'))

	@override_settings(OIDC_INVENTORY_GROUP_PREFIX='')
	def test_empty_prefix_matches_nothing(self):
		self.assertFalse(is_prefix_group('workshop'))


@override_settings(**GROUP_SYNC_SETTINGS)
class GroupSyncTestCase(OIDCTestCase):
	def login_with_groups(self, groups, **claims):
		self.provider.set_user(
			sub='user-1',
			preferred_username='alice',
			name='Alice Example',
			email='alice@example.com',
			email_verified=True,
			**({} if groups is None else {'groups': groups}),
			**claims,
		)
		self.client = APIClient()
		return self.login()

	def alice(self):
		return CustomUser.objects.get(username='alice')

	def inventory_names(self, user):
		return sorted(user.inventories.values_list('name', flat=True))


class InventorySyncTests(GroupSyncTestCase):
	def test_prefix_groups_create_managed_inventories_without_personal_inventory(self):
		response = self.login_with_groups(['openinvento-workshop', 'openinvento-household', 'family'])

		self.assertEqual(response['Location'], '/app')
		self.assertEqual(self.inventory_names(self.alice()), ['household', 'workshop'])
		workshop = Inventory.objects.get(oidc_group='openinvento-workshop')
		self.assertTrue(workshop.oidc_managed)
		self.assertFalse(Inventory.objects.filter(name="alice's Inventory").exists())

	def test_second_group_member_joins_the_existing_inventory(self):
		self.login_with_groups(['openinvento-workshop'])
		self.provider.set_user(sub='user-2', preferred_username='bob', groups=['openinvento-workshop'])
		self.client = APIClient()
		self.login()

		workshop = Inventory.objects.get(oidc_group='openinvento-workshop')
		self.assertEqual(sorted(workshop.users.values_list('username', flat=True)), ['alice', 'bob'])
		self.assertEqual(Inventory.objects.filter(oidc_group__isnull=False).count(), 1)

	def test_long_group_name_is_cut_to_the_inventory_name_length(self):
		self.login_with_groups([PREFIX + 'x' * 200])

		self.assertEqual(self.alice().inventories.get().name, 'x' * 100)

	def test_group_name_longer_than_the_field_is_ignored(self):
		with self.assertLogs('account_auth.oidc_groups', 'WARNING'):
			self.login_with_groups([PREFIX + 'x' * 255])

		self.assertEqual(self.inventory_names(self.alice()), ["alice's Inventory"])
		self.assertFalse(Inventory.objects.filter(oidc_group__isnull=False).exists())

	def test_explicit_mapping_binds_an_existing_inventory(self):
		family = Inventory.objects.create(name='Family')
		with override_settings(OIDC_GROUP_INVENTORIES={'family': str(family.uuid)}):
			self.login_with_groups(['family'])

			family.refresh_from_db()
			self.assertEqual(family.oidc_group, 'family')
			self.assertTrue(family.oidc_managed)
			self.assertEqual(self.inventory_names(self.alice()), ['Family'])

	def test_mapped_inventory_stays_bound_on_the_next_login(self):
		family = Inventory.objects.create(name='Family')
		with override_settings(OIDC_GROUP_INVENTORIES={'family': str(family.uuid)}):
			self.login_with_groups(['family'])
			self.login_with_groups(['family'])

		family.refresh_from_db()
		self.assertEqual(family.oidc_group, 'family')
		self.assertEqual(self.inventory_names(self.alice()), ['Family'])

	def test_mapping_to_an_unknown_inventory_is_ignored(self):
		with override_settings(OIDC_GROUP_INVENTORIES={'family': str(uuid.uuid4())}):
			with self.assertLogs('account_auth.oidc_groups', 'WARNING'):
				self.login_with_groups(['family'])

		self.assertEqual(self.inventory_names(self.alice()), ["alice's Inventory"])

	def test_mapping_to_an_unknown_inventory_keeps_the_bound_inventory(self):
		self.login_with_groups(['openinvento-workshop'])

		# A typo in the UUID must not remove anybody from the inventory the group is bound to.
		with override_settings(OIDC_GROUP_INVENTORIES={'openinvento-workshop': str(uuid.uuid4())}):
			with self.assertLogs('account_auth.oidc_groups', 'WARNING'):
				self.login_with_groups(['openinvento-workshop'])

			workshop = Inventory.objects.get(oidc_group='openinvento-workshop')
			self.assertTrue(workshop.oidc_managed)
			self.assertEqual(self.inventory_names(self.alice()), ['workshop'])

	def test_mapping_takes_over_a_prefix_binding(self):
		self.login_with_groups(['openinvento-workshop'])
		old = Inventory.objects.get(oidc_group='openinvento-workshop')
		new = Inventory.objects.create(name='Workshop (new)')

		with override_settings(OIDC_GROUP_INVENTORIES={'openinvento-workshop': str(new.uuid)}):
			self.login_with_groups(['openinvento-workshop'])

			old.refresh_from_db()
			new.refresh_from_db()
			self.assertIsNone(old.oidc_group)
			self.assertFalse(old.oidc_managed)
			self.assertEqual(new.oidc_group, 'openinvento-workshop')
			# The old inventory became a normal one and keeps its members.
			self.assertEqual(self.inventory_names(self.alice()), ['Workshop (new)', 'workshop'])

	def test_prefix_group_gets_a_new_inventory_when_a_mapping_takes_over_its_own(self):
		self.login_with_groups(['openinvento-workshop'])
		workshop = Inventory.objects.get(oidc_group='openinvento-workshop')

		# 'zoo' sorts after the prefix group, but the mapping must be bound first.
		with override_settings(OIDC_GROUP_INVENTORIES={'zoo': str(workshop.uuid)}):
			self.login_with_groups(['openinvento-workshop', 'zoo'])

			workshop.refresh_from_db()
			self.assertEqual(workshop.oidc_group, 'zoo')
			new = Inventory.objects.get(oidc_group='openinvento-workshop')
			self.assertNotEqual(new.pk, workshop.pk)
			self.assertEqual(set(self.alice().inventories.all()), {workshop, new})

	def test_mapping_wins_over_the_prefix_for_new_groups(self):
		family = Inventory.objects.create(name='Family')
		with override_settings(OIDC_GROUP_INVENTORIES={'openinvento-family': str(family.uuid)}):
			self.login_with_groups(['openinvento-family'])

		self.assertEqual(self.inventory_names(self.alice()), ['Family'])
		self.assertEqual(Inventory.objects.filter(oidc_group__isnull=False).count(), 1)

	def test_leaving_a_group_removes_membership_but_keeps_the_inventory(self):
		self.login_with_groups(['openinvento-workshop', 'openinvento-household'])
		workshop = Inventory.objects.get(oidc_group='openinvento-workshop')
		InventoryEntry.objects.create(inventory=workshop, type='area', name='Garage')

		self.login_with_groups(['openinvento-household'])

		self.assertEqual(self.inventory_names(self.alice()), ['household'])
		workshop.refresh_from_db()
		self.assertFalse(workshop.users.exists())
		self.assertTrue(InventoryEntry.objects.filter(inventory=workshop).exists())

	def test_empty_claim_removes_from_managed_inventories_only(self):
		self.login_with_groups(['openinvento-workshop'])
		shared = Inventory.objects.create(name='Shared')
		self.alice().inventories.add(shared)

		self.login_with_groups([])

		self.assertEqual(self.inventory_names(self.alice()), ['Shared'])
		self.assertTrue(Inventory.objects.filter(oidc_group='openinvento-workshop').exists())

	def test_user_left_without_inventory_gets_a_personal_one(self):
		self.login_with_groups(['openinvento-workshop'])

		self.login_with_groups([])

		self.assertEqual(self.inventory_names(self.alice()), ["alice's Inventory"])

	def test_missing_claim_leaves_memberships_unchanged(self):
		self.login_with_groups(['openinvento-workshop'])

		with self.assertLogs('account_auth.oidc_groups', 'WARNING') as logs:
			self.login_with_groups(None)

		self.assertIn("no usable 'groups' claim", logs.output[0])
		self.assertEqual(self.inventory_names(self.alice()), ['workshop'])

	def test_malformed_claim_leaves_memberships_unchanged(self):
		self.login_with_groups(['openinvento-workshop'])

		with self.assertLogs('account_auth.oidc_groups', 'WARNING'):
			self.login_with_groups({'openinvento-household': True})

		self.assertEqual(self.inventory_names(self.alice()), ['workshop'])

	def test_new_user_without_claim_gets_a_personal_inventory(self):
		with self.assertLogs('account_auth.oidc_groups', 'WARNING'):
			self.login_with_groups(None)

		self.assertEqual(self.inventory_names(self.alice()), ["alice's Inventory"])

	def test_single_string_claim(self):
		self.login_with_groups('openinvento-workshop')

		self.assertEqual(self.inventory_names(self.alice()), ['workshop'])

	@override_settings(OIDC_GROUPS_CLAIM='roles')
	def test_configured_claim_name(self):
		self.login_with_groups(['openinvento-household'], roles=['openinvento-workshop'])

		self.assertEqual(self.inventory_names(self.alice()), ['workshop'])

	def test_groups_from_the_id_token_are_used(self):
		self.provider.set_user(sub='user-1', preferred_username='alice')
		self.provider.id_token_claims['groups'] = ['openinvento-workshop']
		self.login()

		self.assertEqual(self.inventory_names(self.alice()), ['workshop'])

	def test_binding_no_longer_in_the_settings_is_left_alone(self):
		family = Inventory.objects.create(name='Family')
		with override_settings(OIDC_GROUP_INVENTORIES={'family': str(family.uuid)}):
			self.login_with_groups(['family'])

		family.refresh_from_db()
		self.assertFalse(family.oidc_managed)
		self.login_with_groups([])

		# Without the mapping it is a normal inventory, so the sync no longer removes anyone.
		self.assertEqual(self.inventory_names(self.alice()), ['Family'])

	def test_other_members_are_not_touched(self):
		self.login_with_groups(['openinvento-workshop'])
		workshop = Inventory.objects.get(oidc_group='openinvento-workshop')
		local = CustomUser.objects.create_user(username='local', password='StrongPassword!123')
		workshop.users.add(local)

		self.login_with_groups([])

		self.assertEqual(list(workshop.users.all()), [local])

	@override_settings(OIDC_GROUP_SYNC=False)
	def test_sync_off_ignores_groups(self):
		self.login_with_groups(['openinvento-workshop'])

		self.assertEqual(self.inventory_names(self.alice()), ["alice's Inventory"])
		self.assertFalse(Inventory.objects.filter(oidc_group__isnull=False).exists())

	@override_settings(**NO_GROUP_SETTINGS)
	def test_missing_claim_is_not_logged_without_group_settings(self):
		with self.assertNoLogs('account_auth.oidc_groups', 'WARNING'):
			self.login_with_groups(None)


class AllowedGroupsTests(GroupSyncTestCase):
	@override_settings(OIDC_ALLOWED_GROUPS=['staff', 'family'])
	def test_member_of_an_allowed_group_logs_in(self):
		response = self.login_with_groups(['family'])

		self.assertEqual(response['Location'], '/app')

	@override_settings(OIDC_ALLOWED_GROUPS=['staff'])
	def test_other_groups_are_rejected_without_creating_an_account(self):
		self.assert_login_failed(self.login_with_groups(['openinvento-workshop']))

		self.assertFalse(CustomUser.objects.filter(username='alice').exists())
		self.assertFalse(Inventory.objects.exists())

	@override_settings(OIDC_ALLOWED_GROUPS=['staff'])
	def test_missing_claim_is_rejected(self):
		self.assert_login_failed(self.login_with_groups(None))

	def test_existing_user_is_rejected_after_leaving_the_group(self):
		self.login_with_groups(['staff'])

		with override_settings(OIDC_ALLOWED_GROUPS=['staff']):
			self.assert_login_failed(self.login_with_groups(['family']))

	@override_settings(**{**NO_GROUP_SETTINGS, 'OIDC_ALLOWED_GROUPS': ['staff']})
	def test_works_without_group_sync(self):
		self.assert_login_failed(self.login_with_groups(['family']))
		self.assertEqual(self.login_with_groups(['staff'])['Location'], '/app')


class AdminGroupTests(GroupSyncTestCase):
	@override_settings(OIDC_ADMIN_GROUP='admins')
	def test_member_becomes_admin(self):
		self.login_with_groups(['admins'])

		alice = self.alice()
		self.assertTrue(alice.is_superuser)
		self.assertTrue(alice.is_staff)

	@override_settings(OIDC_ADMIN_GROUP='admins')
	def test_non_member_stays_without_admin_access(self):
		self.login_with_groups(['family'])

		self.assertFalse(self.alice().is_superuser)

	@override_settings(OIDC_ADMIN_GROUP='admins')
	def test_non_member_loses_admin_access(self):
		CustomUser.objects.create_superuser(username='breakglass', password='StrongPassword!123')
		self.login_with_groups(['admins'])

		self.login_with_groups(['family'])

		alice = self.alice()
		self.assertFalse(alice.is_superuser)
		self.assertFalse(alice.is_staff)

	@override_settings(OIDC_ADMIN_GROUP='admins')
	def test_last_active_admin_keeps_admin_access(self):
		CustomUser.objects.create_superuser(username='retired', password='StrongPassword!123', is_active=False)
		self.login_with_groups(['admins'])

		with self.assertLogs('account_auth.oidc_groups', 'WARNING'):
			self.login_with_groups([])

		self.assertTrue(self.alice().is_superuser)

	@override_settings(OIDC_ADMIN_GROUP='admins')
	def test_missing_claim_keeps_admin_access(self):
		CustomUser.objects.create_superuser(username='breakglass', password='StrongPassword!123')
		self.login_with_groups(['admins'])

		with self.assertLogs('account_auth.oidc_groups', 'WARNING'):
			self.login_with_groups(None)

		self.assertTrue(self.alice().is_superuser)

	@override_settings(**{**NO_GROUP_SETTINGS, 'OIDC_ADMIN_GROUP': 'admins'})
	def test_works_without_group_sync(self):
		self.login_with_groups(['admins'])

		alice = self.alice()
		self.assertTrue(alice.is_superuser)
		self.assertEqual(self.inventory_names(alice), ["alice's Inventory"])


class ManagedInventoryAPITests(GroupSyncTestCase):
	def setUp(self):
		super().setUp()
		self.login_with_groups(['openinvento-workshop'])
		self.inventory = Inventory.objects.get(oidc_group='openinvento-workshop')
		self.other = CustomUser.objects.create_user(username='other', password='StrongPassword!123')

	def members_url(self, user=None):
		url = f'/api/inventories/{self.inventory.uuid}/members/'
		return f'{url}{user.uuid}/' if user else url

	@override_settings(ALLOW_INVENTORY_USER_INVITES=True)
	def test_members_page_reports_managed_inventory(self):
		data = self.client.get(self.members_url()).data

		self.assertTrue(data['inventory']['oidc_managed'])
		self.assertFalse(data['can_invite'])

	@override_settings(ALLOW_INVENTORY_USER_INVITES=True)
	def test_members_cannot_be_added(self):
		response = self.client.post(self.members_url(), {'user_uuid': str(self.other.uuid)}, format='json')

		self.assertEqual(response.status_code, 403)
		self.assertFalse(self.inventory.users.filter(pk=self.other.pk).exists())

	def test_members_cannot_leave_or_be_removed(self):
		response = self.client.delete(self.members_url(self.alice()))

		self.assertEqual(response.status_code, 403)
		self.assertTrue(Inventory.objects.filter(pk=self.inventory.pk, users=self.alice()).exists())

	def test_members_list_marks_sso_members_as_not_removable(self):
		self.inventory.users.add(self.other)

		members = {member['username']: member['removable'] for member in self.client.get(self.members_url()).data['members']}

		self.assertEqual(members, {'alice': False, 'other': True})

	def test_member_without_sso_can_be_removed(self):
		self.inventory.users.add(self.other)

		response = self.client.delete(self.members_url(self.other))

		self.assertEqual(response.status_code, 204)
		self.assertEqual(list(self.inventory.users.all()), [self.alice()])

	def test_last_member_without_sso_leaving_keeps_the_inventory(self):
		self.login_with_groups([])
		self.inventory.users.add(self.other)
		client = APIClient()
		client.force_authenticate(self.other)

		response = client.delete(self.members_url(self.other))

		self.assertEqual(response.status_code, 204)
		self.assertTrue(Inventory.objects.filter(pk=self.inventory.pk).exists())
		self.assertFalse(self.inventory.users.exists())

	def test_regular_member_cannot_delete_it(self):
		response = self.client.delete(f'/api/inventories/{self.inventory.uuid}/')

		self.assertEqual(response.status_code, 403)
		self.assertTrue(Inventory.objects.filter(pk=self.inventory.pk).exists())

	def test_instance_admin_can_delete_it(self):
		CustomUser.objects.filter(username='alice').update(is_superuser=True, is_staff=True)

		response = self.client.delete(f'/api/inventories/{self.inventory.uuid}/')

		self.assertEqual(response.status_code, 204)
		self.assertFalse(Inventory.objects.filter(pk=self.inventory.pk).exists())

	def test_instance_admin_can_delete_it_without_being_a_member(self):
		# After leaving the group the inventory has no members left.
		self.login_with_groups([])
		CustomUser.objects.filter(username='alice').update(is_superuser=True, is_staff=True)

		response = self.client.delete(f'/api/inventories/{self.inventory.uuid}/')

		self.assertEqual(response.status_code, 204)
		self.assertFalse(Inventory.objects.filter(pk=self.inventory.pk).exists())

	def test_instance_admin_cannot_reach_other_inventories(self):
		other = Inventory.objects.create(name='Private')
		other.users.add(self.other)
		CustomUser.objects.filter(username='alice').update(is_superuser=True, is_staff=True)

		response = self.client.delete(f'/api/inventories/{other.uuid}/')

		self.assertEqual(response.status_code, 404)
		self.assertTrue(Inventory.objects.filter(pk=other.pk).exists())

	def test_member_can_still_rename_it(self):
		response = self.client.patch(f'/api/inventories/{self.inventory.uuid}/', {'name': 'Garage'}, format='json')

		self.assertEqual(response.status_code, 200)
		self.inventory.refresh_from_db()
		self.assertEqual(self.inventory.name, 'Garage')
		self.assertEqual(self.inventory.oidc_group, 'openinvento-workshop')

	@override_settings(OIDC_GROUP_SYNC=False, ALLOW_INVENTORY_USER_INVITES=True)
	def test_turning_sync_off_releases_the_inventory(self):
		self.assertFalse(self.client.get(self.members_url()).data['inventory']['oidc_managed'])
		response = self.client.post(self.members_url(), {'user_uuid': str(self.other.uuid)}, format='json')

		self.assertEqual(response.status_code, 201)
