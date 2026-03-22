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


def test_post_api_schedule_validate_missing_fields():
    auth_cookies = get_auth_cookies()
    # Switch context to set active workspace (required for org-aware endpoints)
    switch_resp = requests.post(
        f'{BASE_ENDPOINT}/auth/switch-context',
        cookies=auth_cookies,
        json={'workspaceId': ORG_ID},
        timeout=30
    )
    # Ensure we switch context successfully before testing schedule/validate
    assert switch_resp.status_code == 200, f"Switch context failed with status {switch_resp.status_code}"

    url = f'{BASE_ENDPOINT}/schedule/validate'
    # Send POST request with empty body (missing required fields)
    resp = requests.post(
        url,
        cookies=auth_cookies,
        json={},  # empty body
        timeout=30
    )
    assert resp.status_code == 400, f"Expected 400 status for missing fields, got {resp.status_code}"
    # Optionally check message content if returned as JSON
    try:
        data = resp.json()
        # The error message might be a string or in a message field
        error_msg = None
        if isinstance(data, dict):
            # common patterns: 'error', 'message', or just string keys
            if 'error' in data and isinstance(data['error'], str):
                error_msg = data['error']
            elif 'message' in data and isinstance(data['message'], str):
                error_msg = data['message']
            elif isinstance(data, str):
                error_msg = data
        if error_msg:
            assert 'missing' in error_msg.lower() or 'required' in error_msg.lower(), \
                f"Unexpected error message: {error_msg}"
    except (json.JSONDecodeError, ValueError):
        # Response is not JSON, no further validation
        pass


test_post_api_schedule_validate_missing_fields()