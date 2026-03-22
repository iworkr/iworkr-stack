import requests

BASE_URL = "http://localhost:3000/api"

def test_get_api_checkout_redirect():
    try:
        response = requests.get(f"{BASE_URL}/checkout", allow_redirects=False, timeout=30)
        assert response.status_code == 302, f"Expected status code 302, got {response.status_code}"
        location = response.headers.get("Location")
        assert location == "/#pricing", f"Expected Location header '/#pricing', got {location}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_get_api_checkout_redirect()