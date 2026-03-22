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

def test_post_notifications_register_device_invalid_body():
    auth_cookies = get_auth_cookies()

    # Switch context to proper workspace to ensure session context is set
    switch_context_resp = requests.post(
        f'{BASE_ENDPOINT}/auth/switch-context',
        cookies=auth_cookies,
        json={'workspaceId': ORG_ID},
        timeout=30
    )
    assert switch_context_resp.status_code == 200, "Failed to switch workspace context before test"

    url = f'{BASE_ENDPOINT}/notifications/register-device'
    payload = {
        "fcm_token": "",
        "device_type": "invalid"
    }
    try:
        response = requests.post(url, cookies=auth_cookies, json=payload, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed with exception: {e}"

    # Validate we get a 400 Validation error
    assert response.status_code == 400, f"Expected status code 400, got {response.status_code}"

    try:
        data = response.json()
    except json.JSONDecodeError:
        # If no JSON body, just pass as 400 is expected
        data = None

    # We expect a validation error message (string) in the body indicating validation error
    if data:
        error_msg_found = False
        # Possible error messages or keys that indicate validation error
        possible_error_fields = ['error', 'message', 'detail', 'validationErrors']
        for field in possible_error_fields:
            if field in data and isinstance(data[field], str) and 'validation' in data[field].lower():
                error_msg_found = True
                break
            # If validationErrors list or dict present
            if field in data and (isinstance(data[field], list) or isinstance(data[field], dict)):
                error_msg_found = True
                break
        assert error_msg_found, f"Expected validation error message in response JSON, got: {data}"

test_post_notifications_register_device_invalid_body()