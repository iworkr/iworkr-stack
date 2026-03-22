import requests

BASE_URL = 'http://localhost:3000/api'

def test_post_api_team_invite_no_auth():
    url = f"{BASE_URL}/team/invite"
    payload = {
        "email": "test@example.com",
        "role": "worker"
    }
    headers = {
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 401, f"Expected 401 Unauthorized, got {response.status_code}"
    # The response body might contain message or error description
    try:
        json_data = response.json()
        assert "Not authenticated" in (
            json_data.get("message", "") + json_data.get("error", "")
        ) or response.status_code == 401
    except ValueError:
        # Response is not JSON, but 401 status code is confirmed
        pass

test_post_api_team_invite_no_auth()