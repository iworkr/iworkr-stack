import requests
import json
import urllib.parse

SUPABASE_URL = 'https://olqjuadvseoxpfjzlghb.supabase.co'
SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9scWp1YWR2c2VveHBmanpsZ2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODQ4ODcsImV4cCI6MjA4NzQ2MDg4N30.1-109HFf0IrDugPm7GPpYoAc_RVBXLDpz1zyojs8kZY'
TEST_USER_EMAIL = 'testsprite-qa@iworkrapp.com'
TEST_USER_PASSWORD = 'TestSprite2026!'
ORG_ID = '00000000-0000-0000-0000-000000000001'
BASE_ENDPOINT = 'http://localhost:3000/api'

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

def test_post_api_team_invite_with_auth():
    auth_cookies = get_auth_cookies()

    # Switch context to set active workspace to ORG_ID (required for org default)
    switch_resp = requests.post(
        f'{BASE_ENDPOINT}/auth/switch-context',
        cookies=auth_cookies,
        json={'workspaceId': ORG_ID},
        timeout=30
    )
    assert switch_resp.status_code == 200, \
        f"Context switch failed with status {switch_resp.status_code}: {switch_resp.text}"

    invite_url = f'{BASE_ENDPOINT}/team/invite'
    invite_data = {
        'email': 'test-invite-unique@example.com',
        'role': 'worker'
    }

    resp = requests.post(
        invite_url,
        cookies=auth_cookies,
        json=invite_data,
        timeout=30
    )

    assert resp.status_code == 200, f"Expected status 200 but got {resp.status_code}: {resp.text}"
    json_data = resp.json()

    assert 'success' in json_data and json_data['success'] is True, "Response missing success=true"
    assert 'invite_id' in json_data and isinstance(json_data['invite_id'], str) and json_data['invite_id'], "Missing or invalid invite_id"
    assert json_data.get('email') == invite_data['email'], f"Email in response does not match request. Expected {invite_data['email']} got {json_data.get('email')}"
    assert json_data.get('role') == invite_data['role'], f"Role in response does not match request. Expected {invite_data['role']} got {json_data.get('role')}"
    assert 'expires_at' in json_data and isinstance(json_data['expires_at'], str) and json_data['expires_at'], "Missing or invalid expires_at"
    # email_sent is optional according to PRD, but if present verify it's boolean
    if 'email_sent' in json_data:
        assert isinstance(json_data['email_sent'], bool), "email_sent is not boolean"

test_post_api_team_invite_with_auth()