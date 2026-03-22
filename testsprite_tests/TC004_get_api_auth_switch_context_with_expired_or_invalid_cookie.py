import requests

def test_get_api_auth_switch_context_with_expired_or_invalid_cookie():
    base_url = "http://localhost:3000/api"
    url = f"{base_url}/auth/switch-context"
    # Use an expired or invalid session cookie string
    expired_invalid_cookie = "session=expired_or_invalid_cookie_value"

    headers = {
        "Cookie": expired_invalid_cookie
    }

    try:
        response = requests.get(url, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 401, f"Expected status 401, got {response.status_code}"

test_get_api_auth_switch_context_with_expired_or_invalid_cookie()