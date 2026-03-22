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

def test_post_notifications_register_device_with_auth():
    auth_cookies = get_auth_cookies()

    # Switch context to organization
    switch_context_resp = requests.post(
        f'{BASE_ENDPOINT}/auth/switch-context',
        cookies=auth_cookies,
        json={'workspaceId': ORG_ID},
        timeout=30
    )
    assert switch_context_resp.status_code == 200, f"Switch context failed with status {switch_context_resp.status_code}"
    data = switch_context_resp.json()
    assert data.get('ok') is True
    assert isinstance(data.get('workspace'), dict)

    # Now perform the POST to register device
    url = f'{BASE_ENDPOINT}/notifications/register-device'
    payload = {
        "fcm_token": "test-token-12345",
        "device_type": "web",
        "app_version": "1.0.0",
        "device_name": "TestSprite Browser"
    }
    response = requests.post(url, cookies=auth_cookies, json=payload, timeout=30)
    assert response.status_code == 200, f"Expected status 200 but got {response.status_code}"
    json_response = response.json()
    assert json_response.get("success") is True

test_post_notifications_register_device_with_auth()