import requests
import json
import urllib.parse

SUPABASE_URL = 'https://olqjuadvseoxpfjzlghb.supabase.co'
SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9scWp1YWR2c2VveHBmanpsZ2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODQ4ODcsImV4cCI6MjA4NzQ2MDg4N30.1-109HFf0IrDugPm7GPpYoAc_RVBXLDpz1zyojs8kZY'
TEST_USER_EMAIL = 'testsprite-qa@iworkrapp.com'
TEST_USER_PASSWORD = 'TestSprite2026!'
BASE_ENDPOINT = "http://localhost:3000/api"


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


def test_post_team_set_password_short_password():
    url = f"{BASE_ENDPOINT}/team/set-password"
    cookies = get_auth_cookies()
    payload = {
        "userId": "00000000-0000-0000-0000-000000000001",
        "password": "abc"
    }
    headers = {
        "Content-Type": "application/json"
    }
    try:
        response = requests.post(url, json=payload, headers=headers, cookies=cookies, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    # Validate response status code is 400 (Bad Request)
    assert response.status_code == 400, f"Expected status code 400, got {response.status_code}"

    # Optionally, validate error message in response body if provided
    try:
        data = response.json()
    except json.JSONDecodeError:
        data = None

    if data:
        # The 400 might include error details about short password
        error_msgs = ['short', 'password', 'length', 'invalid']
        found_error = any(msg in json.dumps(data).lower() for msg in error_msgs)
        assert found_error, f"Expected error message about short password in response body, got: {data}"


test_post_team_set_password_short_password()