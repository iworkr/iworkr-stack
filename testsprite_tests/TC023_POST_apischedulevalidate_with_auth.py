import requests
import json
import urllib.parse

BASE_URL = "http://localhost:3000/api"
SUPABASE_URL = 'https://olqjuadvseoxpfjzlghb.supabase.co'
SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9scWp1YWR2c2VveHBmanpsZ2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODQ4ODcsImV4cCI6MjA4NzQ2MDg4N30.1-109HFf0IrDugPm7GPpYoAc_RVBXLDpz1zyojs8kZY'
TEST_USER_EMAIL = 'testsprite-qa@iworkrapp.com'
TEST_USER_PASSWORD = 'TestSprite2026!'


def get_supabase_session():
    resp = requests.post(
        f'{SUPABASE_URL}/auth/v1/token?grant_type=password',
        headers={
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json'
        },
        json={
            'email': TEST_USER_EMAIL,
            'password': TEST_USER_PASSWORD
        },
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


def test_post_api_schedule_validate_with_auth():
    cookies = get_auth_cookies()
    url = f"{BASE_URL}/schedule/validate"
    payload = {
        "organization_id": "00000000-0000-0000-0000-000000000001",
        "technician_id": "1136cf07-0c68-47fd-ad5a-a3cab2beab14",
        "start_time": "2026-04-01T09:00:00Z",
        "end_time": "2026-04-01T10:00:00Z"
    }
    headers = {
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(url, json=payload, cookies=cookies, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Expected status code 200 but got {response.status_code}"
    try:
        data = response.json()
    except json.JSONDecodeError:
        assert False, "Response is not valid JSON"

    # Validate required keys
    assert "valid" in data, "'valid' key missing in response"
    assert "conflicts" in data, "'conflicts' key missing in response"
    assert "travel" in data, "'travel' key missing in response"
    assert "warnings" in data, "'warnings' key missing in response"

    # Validate types
    assert isinstance(data["valid"], bool), "'valid' should be a boolean"
    assert isinstance(data["conflicts"], list), "'conflicts' should be a list"
    assert isinstance(data["travel"], (dict, list, type(None))), "'travel' should be dict, list, or None"
    assert isinstance(data["warnings"], list), "'warnings' should be a list"


test_post_api_schedule_validate_with_auth()