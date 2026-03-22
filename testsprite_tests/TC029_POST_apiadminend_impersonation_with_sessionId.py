import requests

BASE_URL = "http://localhost:3000/api"


def test_post_api_admin_end_impersonation_with_nonexistent_session_id():
    url = f"{BASE_URL}/admin/end-impersonation"
    payload = {"sessionId": "nonexistent-session-id"}

    try:
        response = requests.post(url, json=payload, timeout=30)
        assert response.status_code in (200, 500), f"Unexpected status code: {response.status_code}"
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, dict), "Response JSON is not an object"
            assert "success" in data, "'success' key not in response"
            assert data["success"] is True, "'success' is not True in response"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"


test_post_api_admin_end_impersonation_with_nonexistent_session_id()