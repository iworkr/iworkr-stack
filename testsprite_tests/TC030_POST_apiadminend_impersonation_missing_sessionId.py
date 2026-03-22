import requests

BASE_URL = "http://localhost:3000/api"


def test_post_admin_end_impersonation_missing_sessionId():
    url = f"{BASE_URL}/admin/end-impersonation"
    headers = {"Content-Type": "application/json"}
    payload = {}

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 400, f"Expected status code 400, got {response.status_code}"

    error_message = response.text.strip()

    assert "missing sessionid" in error_message.lower(), f"Expected error message about missing sessionId, got: {error_message}"


test_post_admin_end_impersonation_missing_sessionId()