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

def switch_context(auth_cookies, workspace_id):
    url = f'{BASE_ENDPOINT}/auth/switch-context'
    resp = requests.post(
        url,
        cookies=auth_cookies,
        json={"workspaceId": workspace_id},
        timeout=30
    )
    resp.raise_for_status()
    return resp

def test_post_api_team_invite_missing_email():
    auth_cookies = get_auth_cookies()
    # Switch context to ensure workspace context (required before invite)
    switch_resp = switch_context(auth_cookies, ORG_ID)
    assert switch_resp.status_code == 200
    payload = {
        "role": "worker"
        # Missing 'email' field intentionally
    }
    url = f'{BASE_ENDPOINT}/team/invite'
    resp = requests.post(
        url,
        cookies=auth_cookies,
        json=payload,
        timeout=30
    )
    # Expect 400 error due to missing email
    assert resp.status_code == 400
    # Response body should contain error message about missing fields or email
    try:
        data = resp.json()
        error_msg = json.dumps(data).lower()
        assert "email" in error_msg or "missing" in error_msg or "invalid" in error_msg
    except Exception:
        # If response is not JSON, just pass as we verified status code
        pass

test_post_api_team_invite_missing_email()
