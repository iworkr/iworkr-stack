import requests

BASE_ENDPOINT = "http://localhost:3000/api"

def test_get_api_checkout_redirect():
    url = f"{BASE_ENDPOINT}/checkout"
    try:
        response = requests.get(url, allow_redirects=False, timeout=30)
        assert response.status_code in (302, 307), f"Expected 302 or 307 redirect, got {response.status_code}"
        # Optionally check 'Location' header presence
        assert "Location" in response.headers, "Redirect response missing 'Location' header"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_get_api_checkout_redirect()