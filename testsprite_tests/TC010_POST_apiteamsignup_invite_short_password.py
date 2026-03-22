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

    assert response.status_code == 400, f"Expected status code 400, got {response.status_code}"
    try:
        data = response.json()
    except Exception:
        assert False, "Response is not valid JSON"

    # We expect an error message related to password too short
    error_msgs = (
        "password too short",
        "password must be at least",
        "password length",
        "password is too short"
    )
    message = ""
    # The error message might be in various fields depending on API design
    # Checking common places for error message
    if isinstance(data, dict):
        # Check common keys for error messages
        for key in ("error", "message", "detail", "msg"):
            if key in data and isinstance(data[key], str):
                message = data[key].lower()
                break

    assert any(err_msg in message for err_msg in error_msgs), \
        f"Expected error about password too short, got message: {message}"

test_post_team_signup_invite_short_password()