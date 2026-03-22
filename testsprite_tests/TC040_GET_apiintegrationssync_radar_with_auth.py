import requests
import json
import urllib.parse

BASE_URL = "http://localhost:3000/api"
SUPABASE_URL = 'https://olqjuadvseoxpfjzlghb.supabase.co'
SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9scWp1YWR2c2VveHBmanpsZ2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODQ4ODcsImV4cCI6MjA4NzQ2MDg4N30.1-109HFf0IrDugPm7GPpYoAc_RVBXLDpz1zyojs8kZY'
TEST_USER_EMAIL = 'testsprite-qa@iworkrapp.com'
TEST_USER_PASSWORD = 'TestSprite2026!'
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

def test_get_api_integrations_sync_radar_with_auth():
    auth_cookies = get_auth_cookies()

    # Perform context switch to the organization workspace to ensure proper context
    switch_resp = requests.post(
        f"{BASE_URL}/auth/switch-context",
        cookies=auth_cookies,
        json={"workspaceId": ORG_ID},
        timeout=30
    )
    assert switch_resp.status_code == 200, f"Context switch failed: {switch_resp.status_code} {switch_resp.text}"

    # Perform the actual GET request with valid session cookie
    params = {"orgId": ORG_ID}
    response = requests.get(
        f"{BASE_URL}/integrations/sync-radar",
        cookies=auth_cookies,
        params=params,
        timeout=30
    )

    assert response.status_code == 200, f"Expected status 200, got {response.status_code} with body {response.text}"
    try:
        data = response.json()
    except json.JSONDecodeError:
        assert False, "Response is not valid JSON"

    assert isinstance(data, dict), "Response JSON is not an object"
    assert 'activeCount' in data, "'activeCount' not in response"
    assert isinstance(data['activeCount'], int), "'activeCount' is not an integer"
    assert 'logs' in data, "'logs' not in response"
    assert isinstance(data['logs'], list), "'logs' is not a list"

test_get_api_integrations_sync_radar_with_auth()