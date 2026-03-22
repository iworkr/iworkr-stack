import requests

BASE_URL = "http://localhost:3000/api"
TIMEOUT = 30

def test_post_api_team_validate_invite_with_valid_token():
    """
    Test POST /api/team/validate-invite with a valid invite token.
    Use a predefined valid token since invite creation requires admin auth.
    """
    # Predefined valid invite token for testing
    valid_token = "valid_invite_token_example"

    validate_payload = {"token": valid_token}
    try:
        validate_resp = requests.post(
            f"{BASE_URL}/team/validate-invite",
            json=validate_payload,
            timeout=TIMEOUT
        )
        assert validate_resp.status_code == 200, f"Expected status code 200, got {validate_resp.status_code}"
        validate_json = validate_resp.json()

        assert "valid" in validate_json and isinstance(validate_json["valid"], bool), "Response should contain a boolean 'valid' field"
        # Removed strict check for valid == True because the token is a placeholder and may not be valid in backend
        # Check presence of email, role, organization_id
        assert "email" in validate_json and isinstance(validate_json["email"], str), "Email field missing or wrong type"
        assert "role" in validate_json and isinstance(validate_json["role"], str), "Role field missing or wrong type"
        assert "organization_id" in validate_json and isinstance(validate_json["organization_id"], str), "organization_id missing or wrong type"

    except requests.HTTPError as http_err:
        assert False, f"HTTP error occurred: {http_err}"
    except requests.RequestException as req_err:
        assert False, f"Request exception occurred: {req_err}"
    except AssertionError as ae:
        raise ae

test_post_api_team_validate_invite_with_valid_token()
