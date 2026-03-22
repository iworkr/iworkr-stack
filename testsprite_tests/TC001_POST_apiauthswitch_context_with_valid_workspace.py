import requests
import json
import urllib.parse

SUPABASE_URL = 'https://olqjuadvseoxpfjzlghb.supabase.co'
SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9scWp1YWR2c2VveHBmanpsZ2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODQ4ODcsImV4cCI6MjA4NzQ2MDg4N30.1-109HFf0IrDugPm7GPpYoAc_RVBXLDpz1zyojs8kZY'
TEST_USER_EMAIL = 'testsprite-qa@iworkrapp.com'
TEST_USER_PASSWORD = 'TestSprite2026!'

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

def test_post_api_auth_switch_context_with_valid_workspace():
    auth_cookies = get_auth_cookies()
    url = f"{BASE_ENDPOINT}/auth/switch-context"
    payload = {
        "workspaceId": "00000000-0000-0000-0000-000000000001"
    }
    try:
        response = requests.post(
            url,
            cookies=auth_cookies,
            json=payload,
            timeout=30
        )
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Expected status 200 but got {response.status_code}"
    try:
        data = response.json()
    except json.JSONDecodeError:
        assert False, "Response is not valid JSON"

    assert "ok" in data, "'ok' field missing in response"
    assert data["ok"] is True, "'ok' field is not True"
    assert "workspace" in data, "'workspace' field missing in response"
    workspace = data["workspace"]
    assert isinstance(workspace, dict), "'workspace' is not an object"
    for field in ("id", "name", "slug", "role"):
        assert field in workspace, f"'{field}' missing in workspace object"
        assert isinstance(workspace[field], str), f"'{field}' is not a string in workspace object"

test_post_api_auth_switch_context_with_valid_workspace()
