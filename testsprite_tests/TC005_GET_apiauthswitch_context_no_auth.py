import requests

BASE_URL = "http://localhost:3000/api"

def test_get_auth_switch_context_no_auth():
    url = f"{BASE_URL}/auth/switch-context"
    try:
        response = requests.get(url, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"
    assert response.status_code == 401, f"Expected 401 Unauthorized but got {response.status_code}"
    # Optionally check response JSON or text message "Not authenticated"
    try:
        json_data = response.json()
        assert "Not authenticated" in (json_data.get("message", "") + json_data.get("error", "") + ""), "Expected 'Not authenticated' message in response"
    except ValueError:
        # Response is not JSON, skip message check
        pass

test_get_auth_switch_context_no_auth()