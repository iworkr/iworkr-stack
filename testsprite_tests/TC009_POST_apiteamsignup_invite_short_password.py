import requests

BASE_URL = "http://localhost:3000/api"

def test_post_team_signup_invite_short_password():
    url = f"{BASE_URL}/team/signup-invite"
    payload = {
        "token": "test",
        "email": "test@test.com",
        "password": "abc"
    }
    headers = {
        "Content-Type": "application/json"
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 400, f"Expected 400 status code but got {response.status_code}"
    try:
        resp_json = response.json()
    except ValueError:
        resp_json = None

    # Check if error message mentions password length or missing fields
    assert resp_json is not None, "Response JSON is None"
    error_msgs = [
        "password length",
        "short password",
        "missing",
        "password",
        "field"
    ]
    message = ""
    if isinstance(resp_json, dict):
        # Check all string values in the response for keywords
        for val in resp_json.values():
            if isinstance(val, str):
                message = val.lower()
                if any(kw in message for kw in error_msgs):
                    break
    assert any(kw in message for kw in error_msgs), f"Response message does not indicate short password: {resp_json}"

test_post_team_signup_invite_short_password()