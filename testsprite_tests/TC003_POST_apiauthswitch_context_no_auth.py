import requests

BASE_URL = 'http://localhost:3000/api'

def test_post_auth_switch_context_no_auth():
    url = f"{BASE_URL}/auth/switch-context"
    payload = {"workspaceId": "00000000-0000-0000-0000-000000000001"}
    try:
        response = requests.post(url, json=payload, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"
    assert response.status_code == 401, f"Expected status 401, got {response.status_code}"

test_post_auth_switch_context_no_auth()