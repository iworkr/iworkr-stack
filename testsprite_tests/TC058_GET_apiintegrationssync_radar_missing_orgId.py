import requests
import json
import urllib.parse

SUPABASE_URL = 'https://olqjuadvseoxpfjzlghb.supabase.co'
SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9scWp1YWR2c2VveHBmanpsZ2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODQ4ODcsImV4cCI6MjA4NzQ2MDg4N30.1-109HFf0IrDugPm7GPpYoAc_RVBXLDpz1zyojs8kZY'
TEST_USER_EMAIL = 'testsprite-qa@iworkrapp.com'
TEST_USER_PASSWORD = 'TestSprite2026!'
BASE_ENDPOINT = 'http://localhost:3000/api'
TIMEOUT = 30

def get_supabase_session():
    resp = requests.post(
        f'{SUPABASE_URL}/auth/v1/token?grant_type=password',
        headers={
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
        },
        json={'email': TEST_USER_EMAIL, 'password': TEST_USER_PASSWORD},
        timeout=TIMEOUT
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

def test_GET_api_integrations_sync_radar_missing_orgId():
    url = f'{BASE_ENDPOINT}/integrations/sync-radar'
    cookies = get_auth_cookies()
    try:
        response = requests.get(url, cookies=cookies, timeout=TIMEOUT)
        # According to PRD, this endpoint returns 200 with sync_status and last_synced, no required query param
        assert response.status_code == 200, f"Expected status code 200, got {response.status_code}, response text: {response.text}"
        data = response.json()
        assert 'sync_status' in data, f"Response JSON missing 'sync_status': {data}"
        assert 'last_synced' in data, f"Response JSON missing 'last_synced': {data}"
    except requests.RequestException as e:
        raise AssertionError(f"Request failed: {e}")


test_GET_api_integrations_sync_radar_missing_orgId()
