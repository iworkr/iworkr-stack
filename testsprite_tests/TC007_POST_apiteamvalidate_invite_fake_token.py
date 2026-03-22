import requests

BASE_URL = "http://localhost:3000/api"

def test_post_api_team_validate_invite_fake_token():
    url = f"{BASE_URL}/team/validate-invite"
    payload = {"token": "nonexistent-fake-token-12345"}
    try:
        response = requests.post(url, json=payload, timeout=30)
        response.raise_for_status()
        json_response = response.json()
        assert response.status_code == 200
        assert "valid" in json_response
        assert json_response["valid"] is False
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_post_api_team_validate_invite_fake_token()