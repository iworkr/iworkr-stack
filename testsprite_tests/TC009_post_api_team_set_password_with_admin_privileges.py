import requests

BASE_URL = "http://localhost:3000/api"
TIMEOUT = 30

# Replace with valid admin session cookie string
ADMIN_SESSION_COOKIE = "session=valid_admin_session_cookie_here"

def test_post_api_team_set_password_with_admin_privileges():
    headers = {
        "Cookie": ADMIN_SESSION_COOKIE,
        "Content-Type": "application/json"
    }
    
    # First, need a userId to set password for
    # We create a new user by sending an invite and signing up, then use userId from signup
    # Finally, delete user if possible (if API supports delete)
    # Since no delete user endpoint is given, we omit deletion
    
    # Invite user
    invite_payload = {
        "email": "testuser_for_password_set@example.com",
        "role": "member"
    }
    try:
        res_invite = requests.post(
            f"{BASE_URL}/team/invite",
            headers=headers,
            json=invite_payload,
            timeout=TIMEOUT
        )
        assert res_invite.status_code == 200, f"Invite failed with status {res_invite.status_code}"
        invite_data = res_invite.json()
        assert invite_data.get("success") is True
        assert "email" in invite_data and invite_data["email"] == invite_payload["email"]
        token = invite_data.get("invite_id") or invite_data.get("token") or None
        # The invite_id is returned but for signup-invite we need token
        # The PRD shows invite response has invite_id but signup-invite needs token, so validate invite to get token
        
        # Validate invite to get token (token needed for signup)
        validate_payload = {"token": str(invite_data.get("invite_id") or "")}
        res_validate = requests.post(
            f"{BASE_URL}/team/validate-invite",
            json=validate_payload,
            timeout=TIMEOUT
        )
        assert res_validate.status_code == 200, f"Validate invite failed with status {res_validate.status_code}"
        validate_data = res_validate.json()
        assert validate_data.get("valid") is True, "Invite token invalid"
        token = validate_payload["token"]
        
        # Signup user with invite token
        signup_payload = {
            "token": token,
            "email": invite_payload["email"],
            "password": "InitialPass123!"
        }
        res_signup = requests.post(
            f"{BASE_URL}/team/signup-invite",
            json=signup_payload,
            timeout=TIMEOUT
        )
        assert res_signup.status_code == 200, f"Signup invite failed with status {res_signup.status_code}"
        signup_data = res_signup.json()
        assert signup_data.get("success") is True
        user_id = signup_data.get("user_id")
        assert user_id is not None, "user_id missing in signup response"
        
        # Now set password for this user using admin privileges
        set_password_payload = {
            "userId": user_id,
            "password": "NewSecurePass456!"
        }
        res_set_password = requests.post(
            f"{BASE_URL}/team/set-password",
            headers=headers,
            json=set_password_payload,
            timeout=TIMEOUT
        )
        assert res_set_password.status_code == 200, f"Set password failed with status {res_set_password.status_code}"
        set_password_data = res_set_password.json()
        assert set_password_data.get("success") is True
        assert "email" in set_password_data and set_password_data["email"] == invite_payload["email"]
    finally:
        # Cleanup would go here if delete user endpoint existed
        pass

test_post_api_team_set_password_with_admin_privileges()