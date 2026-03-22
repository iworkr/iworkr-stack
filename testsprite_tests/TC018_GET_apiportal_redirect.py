import requests

BASE_URL = "http://localhost:3000/api"

def test_get_api_portal_redirect():
    url = f"{BASE_URL}/portal"
    try:
        response = requests.get(url, allow_redirects=False, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 302, f"Expected status code 302, got {response.status_code}"
    location = response.headers.get("Location")
    assert location == "/settings/billing", f"Expected redirect Location '/settings/billing', got {location}"

test_get_api_portal_redirect()