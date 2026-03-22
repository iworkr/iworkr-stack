import requests

BASE_URL = "http://localhost:3000/api"

def test_post_admin_end_impersonation_valid():
    url = f"{BASE_URL}/admin/end-impersonation"
    payload = {"sessionId": "nonexistent-session"}
    try:
        response = requests.post(url, json=payload, timeout=30)
        # Acceptable status codes: 200 or 500
        assert response.status_code in (200, 500), f"Unexpected status code: {response.status_code}"
    except requests.RequestException as e:
        # In case of a request error, fail the test with the exception message
        assert False, f"Request failed: {e}"

test_post_admin_end_impersonation_valid()