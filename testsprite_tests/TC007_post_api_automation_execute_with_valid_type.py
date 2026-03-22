import requests

BASE_URL = "http://localhost:3000/api"
SUPABASE_AUTH_URL = "https://olqjuadvseoxpfjzlghb.supabase.co/auth/v1/token"
SUPABASE_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"  # Typically from environment or config

EMAIL = "testsprite-qa@iworkrapp.com"
PASSWORD = "TestSprite2026!"
ORG_ID = "00000000-0000-0000-0000-000000000001"

def get_access_token():
    headers = {
        "apikey": SUPABASE_API_KEY,
        "Content-Type": "application/json"
    }
    json_body = {
        "grant_type": "password",
        "email": EMAIL,
        "password": PASSWORD
    }
    resp = requests.post(SUPABASE_AUTH_URL, headers=headers, json=json_body, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    access_token = data.get("access_token")
    assert access_token, "No access_token received from auth"
    return access_token

def test_post_api_automation_execute_with_valid_type():
    access_token = get_access_token()
    url = f"{BASE_URL}/automation/execute"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    # Use a valid type string - as the PRD does not specify exact valid type values,
    # we use a plausible example "job_complete" per domain knowledge,
    # or just "default" to indicate a valid type.
    payload = {
        "type": "default",
        "organization_id": ORG_ID
    }
    resp = requests.post(url, headers=headers, json=payload, timeout=30)
    assert resp.status_code == 200, f"Expected status 200 but got {resp.status_code} with body {resp.text}"
    json_resp = resp.json()
    assert isinstance(json_resp, dict), "Response is not a JSON object"
    assert json_resp.get("success") is True or json_resp.get("success") == True, "Expected success to be True"
    # Validate presence of details of flows matched and executed
    assert "flows_matched" in json_resp, "Response missing 'flows_matched'"
    assert "flows_executed" in json_resp, "Response missing 'flows_executed'"
    assert "errors" in json_resp, "Response missing 'errors'"
    # flows_matched and flows_executed should be integers >= 0
    assert isinstance(json_resp["flows_matched"], int) and json_resp["flows_matched"] >= 0, "Invalid flows_matched value"
    assert isinstance(json_resp["flows_executed"], int) and json_resp["flows_executed"] >= 0, "Invalid flows_executed value"
    # errors should be a list
    assert isinstance(json_resp["errors"], list), "Invalid errors value, should be list"

test_post_api_automation_execute_with_valid_type()
