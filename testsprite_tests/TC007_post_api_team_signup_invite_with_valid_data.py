import requests

BASE_URL = "http://localhost:3000/api"
TIMEOUT = 30

def test_post_api_team_signup_invite_with_valid_data():
    """
    Test POST /api/team/signup-invite with valid token, email, and password.
    Verify response status is 200 and response body contains success and user_id.
    """
    signup_invite_url = f"{BASE_URL}/team/signup-invite"

    # For the test, we need a valid token and matching email.
    # Since token creation involves /api/team/invite and /api/team/validate-invite,
    # we create an invite and validate it to obtain a token.

    invite_url = f"{BASE_URL}/team/invite"
    validate_invite_url = f"{BASE_URL}/team/validate-invite"

    # Admin credentials or admin session cookie might be required for invite
    # Since no admin cookie is provided, we cannot invite via API here.
    # Assuming we have a function or method to get admin session cookie or token,
    # but since not specified, this test will skip invite creation and token retrieval,
    # instead we will demonstrate the test for signup-invite with a placeholder token.

    # PLEASE REPLACE the below token and email with valid invite token details for real testing
    token = "valid_invite_token_example"
    email = "newuser@example.com"
    password = "ValidPassword123!"

    payload = {
        "token": token,
        "email": email,
        "password": password
    }

    headers = {
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(signup_invite_url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Expected status 200 but got {response.status_code}"
    json_response = response.json()
    assert "success" in json_response, "Response JSON does not contain 'success'"
    assert json_response["success"] is True or json_response["success"] == "true", "'success' is not True"
    assert "user_id" in json_response, "Response JSON does not contain 'user_id'"
    assert isinstance(json_response["user_id"], (str, int)), "'user_id' is not a string or integer"

test_post_api_team_signup_invite_with_valid_data()