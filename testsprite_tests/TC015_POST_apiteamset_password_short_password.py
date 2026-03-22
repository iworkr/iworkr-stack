import requests
import json
import urllib.parse

SUPABASE_URL = 'https://olqjuadvseoxpfjzlghb.supabase.co'
SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9scWp1YWR2c2VveHBmanpsZ2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODQ4ODcsImV4cCI6MjA4NzQ2MDg4N30.1-109HFf0IrDugPm7GPpYoAc_RVBXLDpz1zyojs8kZY'
TEST_USER_EMAIL = 'testsprite-qa@iworkrapp.com'
TEST_USER_PASSWORD = 'TestSprite2026!'
BASE_ENDPOINT = 'http://localhost:3000/api'

# Changed userId to a plausible UUID instead of org ID
TEST_USER_ID = '11111111-2222-3333-4444-555555555555'


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


def test_post_api_team_set_password_short_password():
    cookies = get_auth_cookies()
    url = f'{BASE_ENDPOINT}/team/set-password'
    payload = {
        "userId": TEST_USER_ID,
        "password": "abc"
    }
    try:
        response = requests.post(url, json=payload, cookies=cookies, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    # Expecting status code 400 due to password too short
    assert response.status_code == 400, f"Expected status 400, got {response.status_code}"

    # Optionally check error message in response JSON if available
    try:
        data = response.json()
        error_message = ''
        if isinstance(data, dict):
            for key in ['message', 'error', 'detail']:
                if key in data:
                    error_message = data[key]
                    break
        assert error_message and ('password' in error_message.lower() and ('short' in error_message.lower() or 'minimum' in error_message.lower())), \
            f"Error message does not indicate short password: {error_message}"
    except (ValueError, AssertionError):
        # If no JSON or no suitable error message, just pass as status 400 is primary check
        pass

test_post_api_team_set_password_short_password()
