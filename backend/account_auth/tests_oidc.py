import base64
import hashlib
import hmac
import json
import time
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import jwt
import requests
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from django.contrib.auth import get_user
from django.core.cache import cache
from django.http import HttpRequest
from django.test import TestCase, override_settings
from mozilla_django_oidc.utils import generate_code_challenge
from requests.auth import HTTPBasicAuth
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
	def __init__(self, data=None, status_code=200, url='', content_type='application/json', text=None):
		self._data = data
		self.status_code = status_code
		self.url = url
		self.headers = {'content-type': content_type}
		self.text = str(data) if text is None else text

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
		self.token_request_kwargs = []
		self.token_status = 200
		self.token_response = {}
		self.id_token_claims = {}
		self.id_token_signing = {'key': self.private_key, 'algorithm': 'RS256', 'headers': {'kid': 'test-key'}}
		self.userinfo = {}
		self.userinfo_jwt = None
		self.userinfo_requests = 0
		self.metadata_extra = {}
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
			**self.metadata_extra,
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
		claims = {key: value for key, value in claims.items() if value is not None}
		return jwt.encode(claims, **self.id_token_signing)

	def get(self, url, **kwargs):
		if url == f'{self.issuer}/.well-known/openid-configuration':
			self.discovery_requests += 1
			return FakeResponse(self.metadata, url=url)
		if url == f'{self.issuer}/jwks':
			return FakeResponse(self.jwks, url=url)
		if url == f'{self.issuer}/userinfo':
			self.userinfo_requests += 1
			if self.userinfo_jwt is not None:
				return FakeResponse(url=url, content_type='application/jwt', text=self.userinfo_jwt)
			return FakeResponse(self.userinfo, url=url)
		return FakeResponse({}, status_code=404, url=url)

	def post(self, url, data=None, **kwargs):
		self.token_requests.append(dict(data or {}))
		self.token_request_kwargs.append(kwargs)
		if url != f'{self.issuer}/token' or self.token_status != 200:
			return FakeResponse({'error': 'invalid_grant'}, status_code=400, url=url)
		response = {'id_token': self.id_token(), 'access_token': 'access-token', 'token_type': 'Bearer', **self.token_response}
		return FakeResponse({key: value for key, value in response.items() if value is not None}, url=url)


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

	def test_azp_of_another_client_is_rejected(self):
		self.provider.id_token_claims['azp'] = 'another-client'

		self.assert_login_failed(self.login())

	def test_additional_audiences_are_rejected_even_with_matching_azp(self):
		# OIDC Core 1.0, section 3.1.3.7, step 3: reject tokens with audiences the client does not trust.
		self.provider.id_token_claims['aud'] = [CLIENT_ID, 'another-client']
		self.provider.id_token_claims['azp'] = CLIENT_ID

		self.assert_login_failed(self.login())

	def test_audience_list_with_only_the_client_is_accepted(self):
		self.provider.id_token_claims['aud'] = [CLIENT_ID]
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


def b64url(data):
	return base64.urlsafe_b64encode(data).rstrip(b'=').decode()


def hs256_token(claims, key, kid='test-key'):
	"""Build an HS256 token by hand; PyJWT refuses PEM keys as HMAC secrets."""
	header = b64url(json.dumps({'alg': 'HS256', 'typ': 'JWT', 'kid': kid}).encode())
	payload = b64url(json.dumps(claims).encode())
	signature = hmac.new(key, f'{header}.{payload}'.encode(), hashlib.sha256).digest()
	return f'{header}.{payload}.{b64url(signature)}'


class OIDCHardeningTests(OIDCTestCase):
	"""Requirements from OIDC Core 1.0, RFC 9700, RFC 9207 and RFC 8725 beyond the basic flow."""

	def callback(self, params, **extra):
		return self.client.get('/api/oidc/callback/', {'code': 'auth-code', 'state': params['state'], **extra})

	def id_token_claims(self):
		now = int(time.time())
		return {'iss': ISSUER, 'aud': CLIENT_ID, 'iat': now, 'exp': now + 300, 'sub': 'user-1', 'nonce': self.provider.nonce}

	# Sessions and accounts

	def test_deactivated_oidc_user_loses_session(self):
		self.login()
		CustomUser.objects.filter(username='alice').update(is_active=False)
		request = HttpRequest()
		request.session = self.client.session

		# Non-DRF views (LoginRequiredMiddleware) see the user through the backend's get_user.
		self.assertFalse(get_user(request).is_authenticated)

	def test_login_cycles_session_key(self):
		_, params = self.start_login()
		key_before = self.client.session.session_key

		self.callback(params)

		self.assertNotEqual(self.client.session.session_key, key_before)

	# Token response (OIDC Core 3.1.3.5, RFC 6749 5.1)

	def test_token_response_with_other_token_type_is_rejected(self):
		self.provider.token_response = {'token_type': 'DPoP'}

		self.assert_login_failed(self.login())
		self.assertEqual(self.provider.userinfo_requests, 0)

	def test_token_response_without_token_type_is_rejected(self):
		self.provider.token_response = {'token_type': None}

		self.assert_login_failed(self.login())

	def test_token_type_is_case_insensitive(self):
		self.provider.token_response = {'token_type': 'bearer'}

		self.assertEqual(self.login()['Location'], '/app')

	def test_token_response_without_id_token_fails_cleanly(self):
		self.provider.token_response = {'id_token': None}

		self.assert_login_failed(self.login())

	@override_settings(OIDC_TOKEN_USE_BASIC_AUTH=True)
	def test_basic_auth_sends_secret_in_header(self):
		self.login()

		self.assertNotIn('client_secret', self.provider.token_requests[-1])
		auth = self.provider.token_request_kwargs[-1]['auth']
		self.assertEqual((auth.username, auth.password), (CLIENT_ID, 'client-secret'))
		self.assertIsInstance(auth, HTTPBasicAuth)

	# ID token signature (RFC 8725 3.1, 3.2)

	def test_id_token_alg_none_is_rejected(self):
		self.provider.id_token_signing = {'key': None, 'algorithm': 'none'}

		self.assert_login_failed(self.login())

	def test_id_token_hs256_signed_with_public_key_is_rejected(self):
		public_pem = FakeProvider.private_key.public_key().public_bytes(
			serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo,
		)
		_, params = self.start_login()
		self.provider.token_response = {'id_token': hs256_token(self.id_token_claims(), public_pem)}

		self.assert_login_failed(self.callback(params))

	def test_id_token_with_bad_signature_is_rejected(self):
		other_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
		self.provider.id_token_signing = {'key': other_key, 'algorithm': 'RS256', 'headers': {'kid': 'test-key'}}

		self.assert_login_failed(self.login())

	def test_id_token_with_unknown_kid_is_rejected(self):
		self.provider.id_token_signing['headers'] = {'kid': 'other-key'}

		self.assert_login_failed(self.login())

	def test_id_token_without_kid_and_single_key_is_accepted(self):
		self.provider.id_token_signing['headers'] = {}

		self.assertEqual(self.login()['Location'], '/app')

	def test_id_token_without_kid_and_two_keys_is_rejected(self):
		self.provider.id_token_signing['headers'] = {}
		self.provider.jwks['keys'].append({**self.provider.jwks['keys'][0], 'kid': 'second-key'})

		self.assert_login_failed(self.login())

	def test_id_token_with_other_algorithm_than_configured_is_rejected(self):
		# A JWKS key without "alg" matches any token header, so the algorithm check itself must reject it.
		self.provider.jwks['keys'][0].pop('alg')
		self.provider.id_token_signing['algorithm'] = 'RS384'

		self.assert_login_failed(self.login())

	@override_settings(OIDC_RP_SIGN_ALGO='none')
	def test_unsupported_sign_algo_disables_oidc(self):
		self.assertFalse(APIClient().get('/api/oidc/config/').data['enabled'])
		self.assertEqual(self.client.get('/api/oidc/authenticate/').status_code, 404)

	@override_settings(OIDC_RP_SIGN_ALGO='PS256')
	def test_unsupported_sign_algo_is_logged_at_startup(self):
		from django.apps import apps

		with self.assertLogs('account_auth.oidc', level='ERROR') as logs:
			apps.get_app_config('account_auth').ready()

		self.assertIn('OIDC_SIGN_ALGO', logs.output[0])

	@override_settings(OIDC_RP_SIGN_ALGO='HS256', OIDC_RP_CLIENT_SECRET='short')
	def test_hmac_algo_needs_a_long_client_secret(self):
		self.assertFalse(APIClient().get('/api/oidc/config/').data['enabled'])

	# ID token claims (OIDC Core 3.1.3.7)

	def test_id_token_without_nonce_is_rejected(self):
		self.provider.id_token_claims['nonce'] = None
		_, params = self.start_login()
		self.provider.nonce = None

		self.assert_login_failed(self.callback(params))

	def test_id_token_without_sub_is_rejected(self):
		self.provider.id_token_claims['sub'] = None

		self.assert_login_failed(self.login())

	def test_id_token_without_exp_is_rejected(self):
		self.provider.id_token_claims['exp'] = None

		self.assert_login_failed(self.login())

	def test_multiple_audiences_without_azp_are_rejected(self):
		self.provider.id_token_claims['aud'] = [CLIENT_ID, 'another-client']

		self.assert_login_failed(self.login())

	def test_id_token_iat_slightly_in_future_is_accepted(self):
		# The provider's clock may run a few seconds ahead.
		self.provider.id_token_claims['iat'] = int(time.time()) + 5

		self.assertEqual(self.login()['Location'], '/app')

	def test_id_token_iat_far_in_future_is_rejected(self):
		self.provider.id_token_claims['iat'] = int(time.time()) + 600

		self.assert_login_failed(self.login())

	# UserInfo (OIDC Core 5.3.2)

	def test_userinfo_without_sub_is_rejected(self):
		self.provider.userinfo.pop('sub')

		self.assert_login_failed(self.login())

	def test_userinfo_that_is_not_an_object_fails_cleanly(self):
		self.provider.userinfo = []

		self.assert_login_failed(self.login())

	def test_signed_userinfo_is_accepted(self):
		self.provider.userinfo_jwt = jwt.encode(
			{'iss': ISSUER, 'aud': CLIENT_ID, 'sub': 'user-1', 'preferred_username': 'alice'},
			FakeProvider.private_key, algorithm='RS256', headers={'kid': 'test-key'},
		)

		self.assertEqual(self.login()['Location'], '/app')

	def test_signed_userinfo_with_audience_list_is_accepted(self):
		self.provider.userinfo_jwt = jwt.encode(
			{'iss': ISSUER, 'aud': [CLIENT_ID], 'sub': 'user-1'},
			FakeProvider.private_key, algorithm='RS256', headers={'kid': 'test-key'},
		)

		self.assertEqual(self.login()['Location'], '/app')

	def test_signed_userinfo_with_wrong_audience_is_rejected(self):
		self.provider.userinfo_jwt = jwt.encode(
			{'iss': ISSUER, 'aud': 'another-client', 'sub': 'user-1'},
			FakeProvider.private_key, algorithm='RS256', headers={'kid': 'test-key'},
		)

		self.assert_login_failed(self.login())

	# Authorization request and response (OIDC Core 3.1.2, RFC 9207, RFC 9700)

	@override_settings(OIDC_RP_SCOPES='profile email')
	def test_openid_scope_is_always_requested(self):
		_, params = self.start_login()

		self.assertEqual(params['scope'].split()[0], 'openid')

	@override_settings(
		OIDC_OP_AUTHORIZATION_ENDPOINT='https://login.example.test/auth?tenant=home',
		OIDC_OP_TOKEN_ENDPOINT=f'{ISSUER}/token',
		OIDC_OP_USER_ENDPOINT=f'{ISSUER}/userinfo',
		OIDC_OP_JWKS_ENDPOINT=f'{ISSUER}/jwks',
	)
	def test_authorization_endpoint_query_is_preserved(self):
		response, params = self.start_login()

		self.assertEqual(response['Location'].count('?'), 1)
		self.assertEqual(params['tenant'], 'home')
		self.assertTrue(params['state'])

	@override_settings(OIDC_RP_CLIENT_SECRET='')
	def test_public_client_rejects_provider_without_s256(self):
		self.provider.metadata_extra = {'code_challenge_methods_supported': ['plain']}

		response = self.client.get('/api/oidc/authenticate/')

		self.assertEqual(response['Location'], FAILURE_URL)

	def test_iss_response_parameter_must_match(self):
		_, params = self.start_login()

		self.assert_login_failed(self.callback(params, iss='https://evil.example.test'))

	def test_matching_iss_response_parameter_is_accepted(self):
		_, params = self.start_login()

		self.assertEqual(self.callback(params, iss=ISSUER)['Location'], '/app')

	def test_iss_response_parameter_is_required_when_advertised(self):
		self.provider.metadata_extra = {'authorization_response_iss_parameter_supported': True}

		self.assert_login_failed(self.login())

	def test_expired_state_is_rejected(self):
		_, params = self.start_login()
		session = self.client.session
		session['oidc_states'][params['state']]['added_on'] -= 3600
		session.save()

		self.assert_login_failed(self.callback(params))

	def test_error_without_valid_state_keeps_session(self):
		self.login()

		self.client.get('/api/oidc/callback/', {'error': 'access_denied', 'state': 'forged'})

		self.assertTrue(self.client.get('/api/me/').data['authenticated'])

	def test_next_url_variants_are_rejected(self):
		for next_url in ('//evil.example.test/', '/\\evil.example.test', 'javascript:alert(1)', 'https:evil.example.test'):
			with self.subTest(next_url=next_url):
				self.client.post('/api/logout/')
				response = self.login(f'/api/oidc/authenticate/?next={next_url}')
				self.assertEqual(response['Location'], '/app')

	# Configuration and discovery

	@override_settings(APP_URL='')
	def test_redirect_uri_falls_back_to_request_without_app_url(self):
		_, params = self.start_login()

		self.assertEqual(params['redirect_uri'], 'http://testserver/api/oidc/callback/')

	def test_discovery_without_required_endpoint_fails(self):
		self.provider.metadata_extra = {'jwks_uri': None}

		self.assertEqual(self.client.get('/api/oidc/authenticate/')['Location'], FAILURE_URL)

	def test_invalid_discovery_document_is_not_cached(self):
		self.provider.discovery_issuer = 'https://evil.example.test'
		self.client.get('/api/oidc/authenticate/')
		self.provider.discovery_issuer = ISSUER

		self.assertEqual(self.login()['Location'], '/app')
		self.assertEqual(self.provider.discovery_requests, 2)

	# Transport security (RFC 9700, section 2.6; OpenID Connect Core 1.0, section 16.17)

	def use_issuer(self, issuer):
		self.provider.issuer = self.provider.discovery_issuer = issuer
		return override_settings(OIDC_ISSUER=issuer)

	def test_http_issuer_is_rejected(self):
		with self.use_issuer('http://idp.example.test'):
			response = self.client.get('/api/oidc/authenticate/')

		self.assertEqual(response['Location'], FAILURE_URL)
		self.assertEqual(self.provider.discovery_requests, 0)

	def test_http_endpoint_from_discovery_is_rejected(self):
		self.provider.metadata_extra = {'token_endpoint': 'http://idp.example.test/token'}

		self.assertEqual(self.client.get('/api/oidc/authenticate/')['Location'], FAILURE_URL)

	def test_http_loopback_issuer_is_allowed(self):
		with self.use_issuer('http://localhost:1411'):
			self.provider.id_token_claims['iss'] = 'http://localhost:1411'
			response = self.login()

		self.assertEqual(response['Location'], '/app')

	@override_settings(OIDC_ALLOW_INSECURE_HTTP=True)
	def test_http_issuer_can_be_allowed_explicitly(self):
		with self.use_issuer('http://idp.example.test'):
			self.provider.id_token_claims['iss'] = 'http://idp.example.test'
			response = self.login()

		self.assertEqual(response['Location'], '/app')

	# Profile data

	def test_email_marked_unverified_is_not_stored(self):
		self.provider.set_user(sub='user-2', preferred_username='eve', email='victim@example.com', email_verified=False)

		self.login()

		self.assertIsNone(CustomUser.objects.get(username='eve').email)

	def test_email_without_verification_claim_is_stored(self):
		# Some providers (e.g. Microsoft Entra ID) never send email_verified.
		self.provider.set_user(sub='user-2', preferred_username='eve', email='eve@example.com')

		self.login()

		self.assertEqual(CustomUser.objects.get(username='eve').email, 'eve@example.com')

	def test_wrong_password_does_not_contact_the_provider(self):
		CustomUser.objects.create_user(username='member', password='StrongPassword!123')

		response = APIClient().post('/api/login/', {'identifier': 'member', 'password': 'wrong'}, format='json')

		self.assertEqual(response.status_code, 401)
		self.assertEqual(self.provider.discovery_requests, 0)
