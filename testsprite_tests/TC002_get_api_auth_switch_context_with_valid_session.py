import requests

BASE_URL = "http://localhost:3000/api"
TIMEOUT = 30

def test_get_api_auth_switch_context_with_valid_session():
    session = requests.Session()

    url = f"{BASE_URL}/auth/switch-context"

    try:
        response = session.get(url, timeout=TIMEOUT)
        assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
        json_data = response.json()
        assert 'workspaceId' in json_data, "Response JSON missing 'workspaceId'"
        workspace_id = json_data['workspaceId']
        branch_id = json_data.get('branchId', None)
        assert isinstance(workspace_id, str) and workspace_id, "Invalid workspaceId value"
        assert (branch_id is None) or (isinstance(branch_id, str)), "Invalid branchId value"
    except requests.RequestException as e:
        assert False, f"Request failed: {str(e)}"

test_get_api_auth_switch_context_with_valid_session()