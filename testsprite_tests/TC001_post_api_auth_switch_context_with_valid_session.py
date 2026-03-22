import requests

BASE_URL = "http://localhost:3000/api"
TIMEOUT = 30

def test_post_api_auth_switch_context_with_valid_session():
    # NOTE: For this test, a valid session cookie must be provided.
    # The session cookie is required for authentication to /api/auth/switch-context.
    # Replace the value of SESSION_COOKIE with a valid cookie string for the test environment.
    SESSION_COOKIE = "your_valid_session_cookie_here"

    # Since workspaceId and optionally branchId are required,
    # we first need to find or create a valid workspace to use.
    # We will assume an existing workspaceId for this example.
    # If not available, this test would fail or require another API call to get/create it.
    # Here we try a hypothetical workspaceId; replace it with a valid one.
    workspace_id = "existing-valid-workspace-id"
    branch_id = "optional-valid-branch-id"  # or None to test without branchId

    url = f"{BASE_URL}/auth/switch-context"
    headers = {
        "Content-Type": "application/json",
        "Cookie": SESSION_COOKIE,
    }
    payload = {
        "workspaceId": workspace_id,
    }
    if branch_id:
        payload["branchId"] = branch_id

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"HTTP request failed: {e}"

    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"
    try:
        data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    assert "ok" in data and data["ok"] is True, "Response 'ok' field is not True"
    assert "workspace" in data and isinstance(data["workspace"], dict), "Missing or invalid 'workspace' field"
    workspace = data["workspace"]
    for field in ["id", "name", "slug", "role"]:
        assert field in workspace and isinstance(workspace[field], str), f"Missing or invalid workspace.{field} field"

test_post_api_auth_switch_context_with_valid_session()