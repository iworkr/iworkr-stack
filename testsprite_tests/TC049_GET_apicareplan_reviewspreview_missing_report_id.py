import requests
import json
import urllib.parse

BASE_URL = 'http://localhost:3000/api'
SUPABASE_URL = 'https://olqjuadvseoxpfjzlghb.supabase.co'
SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9scWp1YWR2c2VveHBmanpsZ2hiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4ODQ4ODcsImV4cCI6MjA4NzQ2MDg4N30.1-109HFf0IrDugPm7GPpYoAc_RVBXLDpz1zyojs8kZY'
TEST_USER_EMAIL = 'testsprite-qa@iworkrapp.com'
TEST_USER_PASSWORD = 'TestSprite2026!'
ORG_ID = '00000000-0000-0000-0000-000000000001'

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

def authenticate_workspace_context(cookies):
    switch_context_url = f'{BASE_URL}/auth/switch-context'
    resp = requests.post(
        switch_context_url,
        cookies=cookies,
        json={'workspaceId': ORG_ID},
        timeout=30
    )
    resp.raise_for_status()
    # Ensure the workspace is set to org for context
    json_data = resp.json()
    assert resp.status_code == 200, f"Switch context failed: {resp.text}"
    assert json_data.get('ok') is True, f"Switch context response 'ok' not true: {json_data}"
    workspace = json_data.get('workspace')
    assert workspace and workspace.get('id') == ORG_ID, f"Workspace ID mismatch: {json_data}"
    return True

def test_get_plan_reviews_preview_missing_report_id():
    cookies = get_auth_cookies()
    authenticate_workspace_context(cookies)
    url = f'{BASE_URL}/care/plan-reviews/preview'
    resp = requests.get(url, cookies=cookies, timeout=30)
    assert resp.status_code == 400, f"Expected status 400 but got {resp.status_code} with body {resp.text}"
    # The body likely contains the string about missing report_id
    try:
        res_json = resp.json()
        # Validate error message presence if JSON response
        error_msg = json.dumps(res_json).lower()
        assert 'missing' in error_msg and 'report_id' in error_msg, f"Error message does not mention missing report_id: {res_json}"
    except Exception:
        # If response is not JSON, check plain text body:
        body_lower = resp.text.lower()
        assert 'missing' in body_lower and 'report_id' in body_lower, f"Error message does not mention missing report_id: {resp.text}"

test_get_plan_reviews_preview_missing_report_id()