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

def test_get_user_organization_with_auth():
    cookies = get_auth_cookies()
    url = f'{BASE_ENDPOINT}/user/organization'
    try:
        response = requests.get(url, cookies=cookies, timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
        json_data = response.json()
        assert 'organization_id' in json_data, "Response JSON missing 'organization_id'"
        assert isinstance(json_data['organization_id'], str) and json_data['organization_id'], "'organization_id' should be a non-empty string"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_get_user_organization_with_auth()
