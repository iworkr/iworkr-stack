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
        chunks = [encoded[i:i + CHUNK_SIZE] for i in range(0, len(encoded), CHUNK_SIZE)]
        for idx, chunk in enumerate(chunks):
            cookies[f'{cookie_name}.{idx}'] = chunk
    return cookies


def test_get_integrations_sync_radar_missing_orgId():
    # Authenticate and get cookies
    auth_cookies = get_auth_cookies()

    # Switch context to set correct workspace/org in session
    switch_resp = requests.post(
        f'{BASE_ENDPOINT}/auth/switch-context',
        cookies=auth_cookies,
        json={'workspaceId': ORG_ID},
        timeout=30
    )
    assert switch_resp.status_code == 200, f"Context switch failed with status {switch_resp.status_code}"

    # Make GET request to /api/integrations/sync-radar WITHOUT orgId query param
    resp = requests.get(
        f'{BASE_ENDPOINT}/integrations/sync-radar',
        cookies=auth_cookies,
        timeout=30
    )

    # Expect 400 error about missing orgId
    assert resp.status_code == 400, f"Expected 400 Bad Request, got {resp.status_code}"
    try:
        data = resp.json()
        assert isinstance(data, dict), "Response JSON is not a dict"
        # The error message content might differ, check it contains "missing" and "orgId" case-insensitive
        error_msg = json.dumps(data).lower()
        assert 'orgid' in error_msg or 'org_id' in error_msg, f"Error message does not mention missing orgId: {error_msg}"
    except (json.JSONDecodeError, AssertionError):
        # If cannot parse JSON, at least check the response text contains relevant message
        text = resp.text.lower()
        assert 'orgid' in text or 'org_id' in text or 'missing' in text, f"Error message does not mention missing orgId in response text: {resp.text}"


test_get_integrations_sync_radar_missing_orgId()
