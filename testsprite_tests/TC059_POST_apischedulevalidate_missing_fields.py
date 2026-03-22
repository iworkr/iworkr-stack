import requests
import json
import urllib.parse

SUPABASE_URL = 'https://olqjuadvseoxpfjzlghb.supabase.co'
SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9scWp1YWR2c2VveHBmanpsZ2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODQ4ODcsImV4cCI6MjA4NzQ2MDg4N30.1-109HFf0IrDugPm7GPpYoAc_RVBXLDpz1zyojs8kZY'
TEST_USER_EMAIL = 'testsprite-qa@iworkrapp.com'
TEST_USER_PASSWORD = 'TestSprite2026!'


def get_supabase_session():
    resp = requests.post(
        f'{SUPABASE_URL}/auth/v1/token?grant_type=password',
        headers={
            'apikey': SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
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


def test_post_schedule_validate_missing_fields():
    base_url = 'http://localhost:3000/api'
    url = f'{base_url}/schedule/validate'
    cookies = get_auth_cookies()
    payload = {
        'organization_id': 'org_example_id',
        'technician_id': 'tech_example_id',
        'start_time': '2026-03-16T09:00:00Z',
        'end_time': '2026-03-16T10:00:00Z'
    }
    try:
        response = requests.post(
            url,
            json=payload,
            cookies=cookies,
            timeout=30
        )
    except requests.RequestException as e:
        assert False, f'Request failed: {e}'

    assert response.status_code == 200, f'Expected status code 200 but got {response.status_code}'

    try:
        json_body = response.json()
        assert 'valid' in json_body, f"Response missing 'valid' key: {json_body}"
        assert isinstance(json_body['valid'], bool), f"Expected 'valid' to be bool, got {type(json_body['valid'])}"
        assert 'conflicts' in json_body, f"Response missing 'conflicts' key: {json_body}"
        assert 'travel' in json_body, f"Response missing 'travel' key: {json_body}"
        assert 'warnings' in json_body, f"Response missing 'warnings' key: {json_body}"
    except json.JSONDecodeError:
        assert False, 'Response is not valid JSON'


test_post_schedule_validate_missing_fields()
