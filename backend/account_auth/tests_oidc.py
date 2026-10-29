import time
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import jwt
import requests
from cryptography.hazmat.primitives.asymmetric import rsa
from django.core.cache import cache
from django.test import TestCase, override_settings
from mozilla_django_oidc.utils import generate_code_challenge
from rest_framework.test import APIClient

from inventory.models import Inventory

from .models import CustomUser, OIDCIdentity

ISSUER = 'https://idp.example.test'
CLIENT_ID = 'openinvento'
APP_URL = 'https://inventory.example.test'
CALLBACK_URL = f'{APP_URL}/api/oidc/callback/'
FAILURE_URL = '/auth/login?error=sso'

OIDC_SETTINGS = {
	'APP_URL': APP_URL,
	'OIDC_ENABLED': True,
	'OIDC_ISSUER': ISSUER,
	'OIDC_RP_CLIENT_ID': CLIENT_ID,
	'OIDC_RP_CLIENT_SECRET': 'client-secret',
	'OIDC_OP_AUTHORIZATION_ENDPOINT': '',
	'OIDC_OP_TOKEN_ENDPOINT': '',
	'OIDC_OP_USER_ENDPOINT': '',
	'OIDC_OP_JWKS_ENDPOINT': '',
	'OIDC_CREATE_USERS': True,
	'OIDC_LINK_EXISTING_BY_EMAIL': False,
	'DISABLE_LOCAL_LOGIN': False,
	'LOCAL_LOGIN_USERS': [],
}


class FakeResponse:
	def __init__(self, data=None, status_code=200, url=''):
		self._data = data
		self.status_code = status_code
		self.url = url
		self.headers = {'content-type': 'application/json'}
		self.text = str(data)

	def json(self):
		return self._data

	def raise_for_status(self):
		if self.status_code >= 400:
			raise requests.HTTPError(f'{self.status_code} for {self.url}', response=self)


class FakeProvider:
	"""Minimal OpenID provider that answers the HTTP calls made by the relying party."""

	private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)

	def __init__(self, issuer=ISSUER):
		self.issuer = issuer
		self.discovery_issuer = issuer
		self.discovery_requests = 0
		self.token_requests = []
		self.token_status = 200
		self.id_token_claims = {}
		self.userinfo = {}
		jwk = jwt.algorithms.RSAAlgorithm.to_jwk(self.private_key.public_key(), as_dict=True)
		self.jwks = {'keys': [{**jwk, 'kid': 'test-key', 'alg': 'RS256', 'use': 'sig'}]}
		self.nonce = None

	@property
	def metadata(self):
		return {
			'issuer': self.discovery_issuer,
			'authorization_endpoint': f'{self.issuer}/authorize',
			'token_endpoint': f'{self.issuer}/token',
			'userinfo_endpoint': f'{self.issuer}/userinfo',
			'jwks_uri': f'{self.issuer}/jwks',
		}

	def set_user(self, sub='user-1', **claims):
		self.userinfo = {'sub': sub, **claims}
		self.id_token_claims = {'sub': sub}

	def id_token(self):
		now = int(time.time())
		claims = {
			'iss': self.issuer,
			'aud': CLIENT_ID,
			'iat': now,
			'exp': now + 300,
			'nonce': self.nonce,
			**self.id_token_claims,
		}
		return jwt.encode(claims, self.private_key, algorithm='RS256', headers={'kid': 'test-key'})

	def get(self, url, **kwargs):
		if url == f'{self.issuer}/.well-known/openid-configuration':
			self.discovery_requests += 1
			return FakeResponse(self.metadata, url=url)
		if url == f'{self.issuer}/jwks':
			return FakeResponse(self.jwks, url=url)
		if url == f'{self.issuer}/userinfo':
			return FakeResponse(self.userinfo, url=url)
		return FakeResponse({}, status_code=404, url=url)

	def post(self, url, data=None, **kwargs):
		self.token_requests.append(dict(data or {}))
		if url != f'{self.issuer}/token' or self.token_status != 200:
			return FakeResponse({'error': 'invalid_grant'}, status_code=400, url=url)
		return FakeResponse({'id_token': self.id_token(), 'access_token': 'access-token'}, url=url)


@override_settings(**OIDC_SETTINGS)
class OIDCTestCase(TestCase):
	def setUp(self):
		cache.clear()
		self.provider = FakeProvider()
		self.provider.set_user(
			sub='user-1',
			preferred_username='alice',
			name='Alice Example',
			email='alice@example.com',
			email_verified=True,
		)
		get_patcher = patch('requests.get', side_effect=self.provider.get)
		post_patcher = patch('requests.post', side_effect=self.provider.post)
		get_patcher.start()
		post_patcher.start()
		self.addCleanup(get_patcher.stop)
		self.addCleanup(post_patcher.stop)
		self.client = APIClient()

	def start_login(self, path='/api/oidc/authenticate/'):
		response = self.client.get(path)
		self.assertEqual(response.status_code, 302)
		query = parse_qs(urlsplit(response['Location']).query)
		params = {key: values[0] for key, values in query.items()}
		self.provider.nonce = params.get('nonce')
		return response, params

	def login(self, path='/api/oidc/authenticate/'):
		_, params = self.start_login(path)
		return self.client.get('/api/oidc/callback/', {'code': 'auth-code', 'state': params['state']})

	def assert_login_failed(self, response):
		self.assertEqual(response.status_code, 302)
		self.assertEqual(response['Location'], FAILURE_URL)
		self.assertFalse(self.client.get('/api/me/').data['authenticated'])


class OIDCConfigTests(OIDCTestCase):
	@override_settings(OIDC_ENABLED=False)
	def test_config_reports_disabled_oidc(self):
		response = APIClient().get('/api/oidc/config/')

		self.assertEqual(response.status_code, 200)
		self.assertFalse(response.data['enabled'])
		self.assertTrue(response.data['local_login_enabled'])

	@override_settings(OIDC_BUTTON_LABEL='Pocket ID', OIDC_AUTO_REDIRECT=True, DISABLE_LOCAL_LOGIN=True)
	def test_config_is_public_and_exposes_only_login_page_settings(self):
		response = APIClient().get('/api/oidc/config/')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data, {
			'enabled': True,
			'button_label': 'Pocket ID',
			'auto_redirect': True,
			'local_login_enabled': False,
		})

	@override_settings(OIDC_ENABLED=False)
	def test_login_endpoints_return_404_when_disabled(self):
		self.assertEqual(self.client.get('/api/oidc/authenticate/').status_code, 404)
		self.assertEqual(self.client.get('/api/oidc/callback/', {'code': 'x', 'state': 'y'}).status_code, 404)


class OIDCAuthenticationRequestTests(OIDCTestCase):
	def test_redirects_to_discovered_endpoint_with_pkce_state_and_nonce(self):
		response, params = self.start_login()

		self.assertTrue(response['Location'].startswith(f'{ISSUER}/authorize?'))
		self.assertEqual(params['response_type'], 'code')
		self.assertEqual(params['client_id'], CLIENT_ID)
		self.assertEqual(params['scope'], 'openid profile email')
		self.assertEqual(params['code_challenge_method'], 'S256')
		self.assertTrue(params['state'])
		self.assertTrue(params['nonce'])
		session_state = self.client.session['oidc_states'][params['state']]
		self.assertEqual(
			params['code_challenge'],
			generate_code_challenge(session_state['code_verifier'], 'S256'),
		)

	def test_redirect_uri_is_built_from_app_url(self):
		# Behind a TLS-terminating proxy the request itself looks like plain HTTP.
		_, params = self.start_login()

		self.assertEqual(params['redirect_uri'], CALLBACK_URL)

	@override_settings(
		OIDC_OP_AUTHORIZATION_ENDPOINT='https://login.example.test/auth',
		OIDC_OP_TOKEN_ENDPOINT=f'{ISSUER}/token',
		OIDC_OP_USER_ENDPOINT=f'{ISSUER}/userinfo',
		OIDC_OP_JWKS_ENDPOINT=f'{ISSUER}/jwks',
	)
	def test_explicit_endpoints_skip_discovery(self):
		response, _ = self.start_login()

		self.assertTrue(response['Location'].startswith('https://login.example.test/auth?'))
		self.assertEqual(self.provider.discovery_requests, 0)

	def test_discovery_document_is_cached(self):
		self.login()
		self.client.post('/api/logout/')
		self.login()

		self.assertEqual(self.provider.discovery_requests, 1)

	def test_discovery_issuer_mismatch_fails_without_server_error(self):
		self.provider.discovery_issuer = 'https://evil.example.test'

		response = self.client.get('/api/oidc/authenticate/')

		self.assertEqual(response.status_code, 302)
		self.assertEqual(response['Location'], FAILURE_URL)

	def test_unreachable_provider_fails_without_server_error(self):
		with patch('requests.get', side_effect=requests.ConnectionError('down')):
			response = self.client.get('/api/oidc/authenticate/')

		self.assertEqual(response.status_code, 302)
		self.assertEqual(response['Location'], FAILURE_URL)


class OIDCCallbackTests(OIDCTestCase):
	def test_first_login_creates_user_identity_and_inventory(self):
		response = self.login()

		self.assertEqual(response.status_code, 302)
		self.assertEqual(response['Location'], '/app')
		user = CustomUser.objects.get(username='alice')
		self.assertEqual(user.name, 'Alice Example')
		self.assertEqual(user.email, 'alice@example.com')
		self.assertFalse(user.has_usable_password())
		self.assertFalse(user.require_reset)
		self.assertFalse(user.is_superuser)
		self.assertEqual(user.inventories.count(), 1)
		identity = OIDCIdentity.objects.get(user=user)
		self.assertEqual((identity.issuer, identity.subject), (ISSUER, 'user-1'))
		me = self.client.get('/api/me/').data
		self.assertTrue(me['authenticated'])
		self.assertEqual(me['user']['username'], 'alice')
		self.assertFalse(me['user']['has_password'])

	def test_token_request_uses_pkce_verifier_and_app_url(self):
		_, params = self.start_login()
		code_verifier = self.client.session['oidc_states'][params['state']]['code_verifier']

		self.client.get('/api/oidc/callback/', {'code': 'auth-code', 'state': params['state']})

		token_request = self.provider.token_requests[-1]
		self.assertEqual(token_request['code_verifier'], code_verifier)
		self.assertEqual(token_request['redirect_uri'], CALLBACK_URL)
		self.assertEqual(token_request['client_secret'], 'client-secret')

	@override_settings(OIDC_RP_CLIENT_SECRET='')
	def test_public_client_does_not_send_empty_secret(self):
		self.login()

		self.assertNotIn('client_secret', self.provider.token_requests[-1])
		self.assertTrue(CustomUser.objects.filter(username='alice').exists())

	def test_next_login_reuses_identity_and_updates_profile(self):
		self.login()
		self.client.post('/api/logout/')
		self.provider.set_user(
			sub='user-1',
			preferred_username='alice-renamed',
			name='Alice Renamed',
			email='alice.new@example.com',
		)

		self.login()

		self.assertEqual(CustomUser.objects.count(), 1)
		self.assertEqual(Inventory.objects.count(), 1)
		user = CustomUser.objects.get()
		# The username is only taken from the provider when the account is created.
		self.assertEqual(user.username, 'alice')
		self.assertEqual(user.name, 'Alice Renamed')
		self.assertEqual(user.email, 'alice.new@example.com')

	def test_redirects_to_safe_next_url(self):
		response = self.login('/api/oidc/authenticate/?next=/app/settings')

		self.assertEqual(response['Location'], '/app/settings')

	def test_ignores_external_next_url(self):
		response = self.login('/api/oidc/authenticate/?next=https://evil.example.test/')

		self.assertEqual(response['Location'], '/app')

	def test_username_collision_gets_suffix_and_never_links(self):
		local_user = CustomUser.objects.create_user(username='alice', password='StrongPassword!123', name='Local')

		self.login()

		user = OIDCIdentity.objects.get().user
		self.assertNotEqual(user, local_user)
		self.assertEqual(user.username, 'alice_2')
		local_user.refresh_from_db()
		self.assertEqual(local_user.name, 'Local')

	def test_invalid_username_characters_are_replaced(self):
		self.provider.set_user(sub='user-2', preferred_username='Bob Builder!', name='Bob')

		self.login()

		self.assertEqual(OIDCIdentity.objects.get().user.username, 'Bob_Builder_')

	def test_username_falls_back_to_email_local_part(self):
		self.provider.set_user(sub='user-2', email='carol@example.com', name='Carol')

		self.login()

		self.assertEqual(OIDCIdentity.objects.get().user.username, 'carol')

	def test_long_name_is_truncated(self):
		self.provider.set_user(sub='user-2', preferred_username='dave', name='D' * 80)

		self.login()

		self.assertEqual(len(CustomUser.objects.get(username='dave').name), 35)

	def test_existing_email_is_not_linked_by_default(self):
		local_user = CustomUser.objects.create_user(
			username='local-alice', email='alice@example.com', password='StrongPassword!123',
		)

		self.login()

		user = OIDCIdentity.objects.get().user
		self.assertNotEqual(user, local_user)
		# The email address belongs to another account, so it stays empty.
		self.assertIsNone(user.email)

	@override_settings(OIDC_LINK_EXISTING_BY_EMAIL=True)
	def test_existing_email_is_linked_when_enabled_and_verified(self):
		local_user = CustomUser.objects.create_user(
			username='local-alice', email='Alice@Example.com', password='StrongPassword!123',
		)

		self.login()

		self.assertEqual(OIDCIdentity.objects.get().user, local_user)
		self.assertEqual(CustomUser.objects.count(), 1)
		local_user.refresh_from_db()
		# Linking keeps the existing local password.
		self.assertTrue(local_user.check_password('StrongPassword!123'))

	@override_settings(OIDC_LINK_EXISTING_BY_EMAIL=True)
	def test_unverified_email_is_never_linked(self):
		local_user = CustomUser.objects.create_user(username='local-alice', email='alice@example.com')
		self.provider.set_user(sub='user-1', preferred_username='alice', email='alice@example.com', email_verified=False)

		self.login()

		self.assertNotEqual(OIDCIdentity.objects.get().user, local_user)

	@override_settings(OIDC_LINK_EXISTING_BY_EMAIL=True)
	def test_account_already_linked_to_another_subject_is_not_relinked(self):
		local_user = CustomUser.objects.create_user(username='local-alice', email='alice@example.com')
		OIDCIdentity.objects.create(user=local_user, issuer=ISSUER, subject='someone-else')

		self.login()

		self.assertNotEqual(OIDCIdentity.objects.get(subject='user-1').user, local_user)

	@override_settings(OIDC_CREATE_USERS=False)
	def test_unknown_user_is_rejected_when_creation_is_disabled(self):
		self.assert_login_failed(self.login())
		self.assertFalse(CustomUser.objects.exists())

	@override_settings(OIDC_CREATE_USERS=False)
	def test_known_identity_can_log_in_when_creation_is_disabled(self):
		user = CustomUser.objects.create_user(username='alice')
		OIDCIdentity.objects.create(user=user, issuer=ISSUER, subject='user-1')

		self.assertEqual(self.login()['Location'], '/app')

	def test_parallel_first_login_reuses_the_identity_created_first(self):
		# A second browser tab links the account between our identity lookup and our insert,
		# so the lookup misses and the insert hits the unique constraint.
		other_tab_user = CustomUser.objects.create_user(username='alice-other-tab')
		OIDCIdentity.objects.create(user=other_tab_user, issuer=ISSUER, subject='user-1')
		select_related = OIDCIdentity.objects.select_related
		lookups = []

		def lookup_before_other_tab_commits(*fields):
			lookups.append(fields)
			queryset = select_related(*fields)
			return queryset.none() if len(lookups) == 1 else queryset

		with patch.object(OIDCIdentity.objects, 'select_related', side_effect=lookup_before_other_tab_commits):
			response = self.login()

		self.assertEqual(response['Location'], '/app')
		self.assertEqual(self.client.get('/api/me/').data['user']['username'], 'alice-other-tab')
		# The account created by the losing request is rolled back.
		self.assertFalse(CustomUser.objects.filter(username='alice').exists())
		self.assertEqual(OIDCIdentity.objects.count(), 1)

	def test_inactive_user_is_rejected(self):
		user = CustomUser.objects.create_user(username='alice', is_active=False)
		OIDCIdentity.objects.create(user=user, issuer=ISSUER, subject='user-1')

		self.assert_login_failed(self.login())

	def test_wrong_issuer_is_rejected(self):
		self.provider.id_token_claims['iss'] = 'https://evil.example.test'

		self.assert_login_failed(self.login())
		self.assertFalse(CustomUser.objects.exists())

	def test_wrong_audience_is_rejected(self):
		self.provider.id_token_claims['aud'] = 'another-client'

		self.assert_login_failed(self.login())

	def test_multiple_audiences_require_matching_azp(self):
		self.provider.id_token_claims['aud'] = [CLIENT_ID, 'another-client']
		self.provider.id_token_claims['azp'] = 'another-client'

		self.assert_login_failed(self.login())

	def test_multiple_audiences_with_matching_azp_are_accepted(self):
		self.provider.id_token_claims['aud'] = [CLIENT_ID, 'another-client']
		self.provider.id_token_claims['azp'] = CLIENT_ID

		self.assertEqual(self.login()['Location'], '/app')

	def test_wrong_nonce_is_rejected(self):
		_, params = self.start_login()
		self.provider.nonce = 'forged-nonce'

		response = self.client.get('/api/oidc/callback/', {'code': 'auth-code', 'state': params['state']})

		self.assert_login_failed(response)

	def test_expired_id_token_is_rejected(self):
		self.provider.id_token_claims['exp'] = int(time.time()) - 600

		self.assert_login_failed(self.login())

	def test_userinfo_subject_mismatch_is_rejected(self):
		_, params = self.start_login()
		self.provider.userinfo['sub'] = 'another-user'

		response = self.client.get('/api/oidc/callback/', {'code': 'auth-code', 'state': params['state']})

		self.assert_login_failed(response)

	def test_unknown_state_is_rejected(self):
		self.start_login()

		self.assert_login_failed(self.client.get('/api/oidc/callback/', {'code': 'auth-code', 'state': 'unknown'}))

	def test_state_cannot_be_replayed(self):
		_, params = self.start_login()
		self.client.get('/api/oidc/callback/', {'code': 'auth-code', 'state': params['state']})
		self.client.post('/api/logout/')

		self.assert_login_failed(self.client.get('/api/oidc/callback/', {'code': 'auth-code', 'state': params['state']}))

	def test_token_endpoint_error_fails_without_server_error(self):
		self.provider.token_status = 400

		self.assert_login_failed(self.login())

	def test_provider_error_response_fails(self):
		_, params = self.start_login()

		response = self.client.get('/api/oidc/callback/', {'error': 'access_denied', 'state': params['state']})

		self.assert_login_failed(response)


class LocalLoginTests(OIDCTestCase):
	def setUp(self):
		super().setUp()
		CustomUser.objects.create_user(username='member', password='StrongPassword!123')
		CustomUser.objects.create_superuser(username='breakglass', password='StrongPassword!123', name='Admin')

	def password_login(self, username):
		return APIClient().post('/api/login/', {'identifier': username, 'password': 'StrongPassword!123'}, format='json')

	def test_local_login_works_by_default(self):
		self.assertEqual(self.password_login('member').status_code, 200)

	@override_settings(DISABLE_LOCAL_LOGIN=True, LOCAL_LOGIN_USERS=['breakglass'])
	def test_disabled_local_login_rejects_regular_users(self):
		response = self.password_login('member')

		self.assertEqual(response.status_code, 403)
		self.assertEqual(response.data['error'], 'Local login is disabled for this instance')

	@override_settings(DISABLE_LOCAL_LOGIN=True, LOCAL_LOGIN_USERS=['breakglass'])
	def test_disabled_local_login_rejects_wrong_password_the_same_way(self):
		response = APIClient().post('/api/login/', {'identifier': 'member', 'password': 'wrong'}, format='json')

		self.assertEqual(response.status_code, 403)

	@override_settings(DISABLE_LOCAL_LOGIN=True, LOCAL_LOGIN_USERS=['breakglass'])
	def test_break_glass_user_can_still_log_in_locally(self):
		self.assertEqual(self.password_login('breakglass').status_code, 200)

	@override_settings(DISABLE_LOCAL_LOGIN=True, LOCAL_LOGIN_USERS=['BreakGlass'])
	def test_break_glass_list_is_matched_case_insensitively(self):
		self.assertEqual(self.password_login('breakglass').status_code, 200)

	@override_settings(DISABLE_LOCAL_LOGIN=True, LOCAL_LOGIN_USERS=['breakglass'], ENABLE_SIGNUP=True)
	def test_disabled_local_login_also_disables_signup(self):
		response = APIClient().post('/api/signup/', {
			'username': 'newuser',
			'name': 'New User',
			'password': 'StrongPassword!123',
		}, format='json')

		self.assertEqual(response.status_code, 403)
		self.assertFalse(CustomUser.objects.filter(username='newuser').exists())

	@override_settings(DISABLE_LOCAL_LOGIN=True, LOCAL_LOGIN_USERS=['breakglass'])
	def test_oidc_login_works_while_local_login_is_disabled(self):
		self.assertEqual(self.login()['Location'], '/app')

	@override_settings(DISABLE_LOCAL_LOGIN=True, LOCAL_LOGIN_USERS=['breakglass'])
	def test_break_glass_user_cannot_rename_itself(self):
		# The initial admin is asked for new credentials on first login; a new username would lock it out.
		client = APIClient()
		client.force_login(CustomUser.objects.get(username='breakglass'))

		response = client.post('/api/credentials/reset/', {
			'username': 'admin', 'password': 'AnotherStrongPassword!123',
		}, format='json')

		self.assertEqual(response.status_code, 400)
		self.assertIn('username', response.data)
		self.assertEqual(client.post('/api/credentials/reset/', {
			'username': 'breakglass', 'password': 'AnotherStrongPassword!123',
		}, format='json').status_code, 200)

	@override_settings(DISABLE_LOCAL_LOGIN=True, LOCAL_LOGIN_USERS=['breakglass', 'spare'])
	def test_regular_user_cannot_take_a_break_glass_username(self):
		client = APIClient()
		client.force_login(CustomUser.objects.get(username='member'))

		response = client.post('/api/credentials/reset/', {'username': 'Spare'}, format='json')

		self.assertEqual(response.status_code, 400)

	@override_settings(DISABLE_LOCAL_LOGIN=True, LOCAL_LOGIN_USERS=['breakglass'])
	def test_admin_cannot_rename_break_glass_user(self):
		client = APIClient()
		client.force_login(CustomUser.objects.get(username='breakglass'))
		member = CustomUser.objects.get(username='member')

		response = client.patch(f'/api/users/{member.uuid}/', {'username': 'breakglass2'}, format='json')
		self.assertEqual(response.status_code, 200)
		breakglass = CustomUser.objects.get(username='breakglass')
		response = client.patch(f'/api/users/{breakglass.uuid}/', {'username': 'renamed'}, format='json')
		self.assertEqual(response.status_code, 400)

	def test_break_glass_names_are_not_reserved_while_local_login_is_enabled(self):
		client = APIClient()
		client.force_login(CustomUser.objects.get(username='breakglass'))

		response = client.post('/api/credentials/reset/', {'username': 'admin'}, format='json')

		self.assertEqual(response.status_code, 200)


class OIDCAccountTests(OIDCTestCase):
	def test_oidc_user_cannot_set_a_password(self):
		self.login()

		response = self.client.post('/api/credentials/reset/', {
			'username': 'alice',
			'password': 'AnotherStrongPassword!123',
		}, format='json')

		self.assertEqual(response.status_code, 400)
		self.assertIn('password', response.data)
		self.assertFalse(CustomUser.objects.get(username='alice').has_usable_password())

	def test_oidc_user_can_still_update_name(self):
		self.login()

		response = self.client.post('/api/credentials/reset/', {'username': 'alice', 'name': 'Alice Local'}, format='json')

		self.assertEqual(response.status_code, 200)
		self.assertEqual(CustomUser.objects.get(username='alice').name, 'Alice Local')

	def test_local_user_reports_password(self):
		user = CustomUser.objects.create_user(username='member', password='StrongPassword!123')
		self.client.force_login(user)

		self.assertTrue(self.client.get('/api/me/').data['user']['has_password'])

	def test_password_login_does_not_contact_the_provider(self):
		CustomUser.objects.create_user(username='member', password='StrongPassword!123')

		APIClient().post('/api/login/', {'identifier': 'member', 'password': 'StrongPassword!123'}, format='json')

		self.assertEqual(self.provider.discovery_requests, 0)
