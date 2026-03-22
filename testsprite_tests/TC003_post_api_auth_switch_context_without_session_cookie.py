import requests

def test_post_api_auth_switch_context_without_session_cookie():
    base_url = "http://localhost:3000/api"
    url = f"{base_url}/auth/switch-context"
    headers = {
        "Content-Type": "application/json"
    }
    payload = {
        "workspaceId": "dummy-workspace-id"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        assert response.status_code == 401, f"Expected status 401, got {response.status_code}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_post_api_auth_switch_context_without_session_cookie()