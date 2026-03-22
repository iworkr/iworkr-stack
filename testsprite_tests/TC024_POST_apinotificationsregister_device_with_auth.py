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

def test_post_register_device_with_auth():
    cookies = get_auth_cookies()
    url = f'{BASE_ENDPOINT}/notifications/register-device'
    data = {
        'fcm_token': 'test-token-12345',
        'device_type': 'web'
    }
    try:
        response = requests.post(url, json=data, cookies=cookies, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"
    assert response.status_code == 200, f"Expected status 200 OK, got {response.status_code}"
    try:
        json_resp = response.json()
    except json.JSONDecodeError:
        assert False, "Response is not valid JSON"
    assert 'success' in json_resp, "Key 'success' not found in response JSON"
    assert json_resp['success'] is True, f"Expected success: true, got {json_resp['success']}"

test_post_register_device_with_auth()
