import requests

BASE_ENDPOINT = "http://localhost:3000/api"
SUPABASE_AUTH_URL = "https://olqjuadvseoxpfjzlghb.supabase.co/auth/v1/token?grant_type=password"
SUPABASE_API_KEY = "your-supabase-api-key"  # Replace with actual apikey
TEST_USER_EMAIL = "testsprite-qa@iworkrapp.com"
TEST_USER_PASSWORD = "TestSprite2026!"
ORG_ID = "00000000-0000-0000-0000-000000000001"
# Use a valid workspaceId where the test user has access (owner in org)
VALID_WORKSPACE_ID = ORG_ID
VALID_BRANCH_ID = "00000000-0000-0000-0000-000000000010"  # Example optional branchId

def get_access_token():
    headers = {
        "apikey": SUPABASE_API_KEY,
        "Content-Type": "application/json"
    }
    json_body = {
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASSWORD
    }
    try:
        resp = requests.post(SUPABASE_AUTH_URL, headers=headers, json=json_body, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        access_token = data.get("access_token")
        assert access_token, "access_token not found in auth response"
        return access_token
    except requests.RequestException as e:
        raise RuntimeError(f"Failed to get access token: {e}")

def test_post_api_auth_switch_context_success():
    access_token = get_access_token()
    url = f"{BASE_ENDPOINT}/auth/switch-context"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    payload = {
        "workspaceId": VALID_WORKSPACE_ID,
        "branchId": VALID_BRANCH_ID
    }
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
        resp_json = response.json()
        assert "ok" in resp_json, "'ok' key not in response JSON"
        assert resp_json["ok"] is True or resp_json["ok"] == "true", "'ok' value is not True"
        assert "workspace" in resp_json and isinstance(resp_json["workspace"], dict), "'workspace' key missing or not a dict"
        workspace = resp_json["workspace"]
        assert workspace.get("id") == VALID_WORKSPACE_ID or workspace.get("id") == ORG_ID, "Workspace id mismatch"
    except requests.RequestException as e:
        raise RuntimeError(f"Request to switch context failed: {e}")

test_post_api_auth_switch_context_success()