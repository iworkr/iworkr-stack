import requests
import json
import urllib.parse

SUPABASE_URL = 'https://olqjuadvseoxpfjzlghb.supabase.co'
SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9scWp1YWR2c2VveHBmanpsZ2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODQ4ODcsImV4cCI6MjA4NzQ2MDg4N30.1-109HFf0IrDugPm7GPpYoAc_RVBXLDpz1zyojs8kZY'
TEST_USER_EMAIL = 'testsprite-qa@iworkrapp.com'
TEST_USER_PASSWORD = 'TestSprite2026!'
BASE_ENDPOINT = 'http://localhost:3000/api'
ORG_ID = '00000000-0000-0000-0000-000000000001'

def get_supabase_session():
    resp = requests.post(
        f'{SUPABASE_URL}/auth/v1/token?grant_type=password',
        headers={
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
        },
        json={'email': TEST_USER_EMAIL, 'password': TEST_USER_PASSWORD},
        timeout=30
    )
    resp.raise_for_status()
    return resp.json()

def get_auth_cookies():
    session = get_supabase_session()
    session_json = json.dumps(session)
    encoded = urllib.parse.quote(session_json)
    CHUNK_SIZE = 3500
    cookie_name = 'sb-olqjuadvseoxpfjzlghb-auth-token'
    cookies = {}
    if len(encoded) <= CHUNK_SIZE:
        cookies[cookie_name] = encoded
    else:
        chunks = [encoded[i:i+CHUNK_SIZE] for i in range(0, len(encoded), CHUNK_SIZE)]
        for idx, chunk in enumerate(chunks):
            cookies[f'{cookie_name}.{idx}'] = chunk
    return cookies

def test_post_api_stripe_manage_cancel_action():
    auth_cookies = get_auth_cookies()
    url_switch_context = f'{BASE_ENDPOINT}/auth/switch-context'
    # Switch context to the target org to ensure proper workspace context (optional but recommended)
    switch_context_payload = {'workspaceId': ORG_ID}
    switch_resp = requests.post(url_switch_context, cookies=auth_cookies, json=switch_context_payload, timeout=30)
    assert switch_resp.status_code == 200, f'Context switch failed with status {switch_resp.status_code}: {switch_resp.text}'
    # Now perform the POST /api/stripe/manage with cancel action
    url_manage = f'{BASE_ENDPOINT}/stripe/manage'
    payload = {
        "action": "cancel",
        "orgId": ORG_ID
    }
    response = requests.post(url_manage, cookies=auth_cookies, json=payload, timeout=30)
    # Assert status code is one of 200, 401, 403 as per spec
    assert response.status_code in (200, 401, 403), f'Unexpected status code: {response.status_code}, body: {response.text}'
    if response.status_code == 200:
        # Expect JSON with {success:true, message: string}
        try:
            data = response.json()
        except Exception as e:
            assert False, f'Expected JSON response on 200 but failed to parse: {e}'
        assert isinstance(data, dict), "Response JSON not a dict"
        assert data.get('success') is True, f"Expected 'success': True, got {data.get('success')}"
        assert 'message' in data and isinstance(data['message'], str), "'message' field missing or not string"
    elif response.status_code == 401:
        # Unauthorized: expect text message or JSON error
        content_type = response.headers.get('Content-Type', '')
        if 'application/json' in content_type:
            try:
                data = response.json()
                assert 'error' in data or 'message' in data, "Expected 'error' or 'message' in 401 JSON response"
            except Exception:
                assert len(response.text) > 0, "401 response empty"
        else:
            assert len(response.text) > 0, "401 response empty"
    elif response.status_code == 403:
        # Forbidden: expect text message or JSON error
        content_type = response.headers.get('Content-Type', '')
        if 'application/json' in content_type:
            try:
                data = response.json()
                assert 'error' in data or 'message' in data, "Expected 'error' or 'message' in 403 JSON response"
            except Exception:
                assert len(response.text) > 0, "403 response empty"
        else:
            assert len(response.text) > 0, "403 response empty"

test_post_api_stripe_manage_cancel_action()