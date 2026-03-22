import requests

BASE_URL = "http://localhost:3000/api"

def test_get_user_organization_no_auth():
    url = f"{BASE_URL}/user/organization"
    try:
        response = requests.get(url, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"
    assert response.status_code == 401, f"Expected status code 401 but got {response.status_code}"
    try:
        data = response.json()
    except ValueError:
        data = None
    # The 401 response may have a message or error field or empty body
    if data:
        assert "Not authenticated" in str(data).lower() or "error" in data or "message" in data, "401 response body doesn't indicate 'Not authenticated'"

test_get_user_organization_no_auth()