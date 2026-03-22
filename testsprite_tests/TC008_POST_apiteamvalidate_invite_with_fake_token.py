import requests

BASE_URL = "http://localhost:3000/api"

def test_post_team_validate_invite_with_fake_token():
    url = f"{BASE_URL}/team/validate-invite"
    payload = {
        "token": "nonexistent-fake-token-12345"
    }
    headers = {
        "Content-Type": "application/json"
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        assert response.status_code == 200, f"Expected status 200 but got {response.status_code}"
        json_data = response.json()
        assert "valid" in json_data, "Response JSON missing 'valid' field"
        assert json_data["valid"] is False, f"Expected valid to be False but was {json_data['valid']}"
        assert "error" in json_data and isinstance(json_data["error"], str) and len(json_data["error"]) > 0, "Expected non-empty 'error' string in response"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_post_team_validate_invite_with_fake_token()