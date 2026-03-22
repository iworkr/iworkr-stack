import requests

BASE_URL = "http://localhost:3000/api"
SESSION_COOKIE = {"session": "valid_session_cookie_value"}  # Replace with a valid session cookie value

def test_post_api_team_accept_invite_with_valid_session():
    url = f"{BASE_URL}/team/accept-invite"
    headers = {
        "Content-Type": "application/json"
    }
    try:
        response = requests.post(url, headers=headers, cookies=SESSION_COOKIE, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"

    try:
        json_data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    assert "success" in json_data, "'success' key missing in response"
    assert json_data["success"] is True, "'success' key is not True"
    assert "organization_id" in json_data, "'organization_id' key missing in response"
    assert isinstance(json_data["organization_id"], (str, int)), "'organization_id' is not string or int"

test_post_api_team_accept_invite_with_valid_session()
