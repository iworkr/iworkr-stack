import requests
import uuid

def test_post_api_team_invite_with_valid_email():
    base_url = "http://localhost:3000/api"
    supabase_auth_url = "https://olqjuadvseoxpfjzlghb.supabase.co/auth/v1/token"
    supabase_api_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"  # Usually you get this from config; here assumed
    supabase_email = "testsprite-qa@iworkrapp.com"
    supabase_password = "TestSprite2026!"
    org_id = "00000000-0000-0000-0000-000000000001"

    # Get access token
    try:
        auth_resp = requests.post(
            supabase_auth_url,
            headers={
                "apikey": supabase_api_key,
                "Authorization": f"Bearer {supabase_api_key}",
                "Content-Type": "application/x-www-form-urlencoded"
            },
            data={
                "grant_type": "password",
                "email": supabase_email,
                "password": supabase_password
            },
            timeout=30
        )
        auth_resp.raise_for_status()
        auth_data = auth_resp.json()
        access_token = auth_data.get("access_token")
        assert access_token, "Access token not found in auth response"
    except Exception as e:
        assert False, f"Failed to authenticate: {e}"

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    # Prepare invite payload with a unique valid email for testing
    test_email = f"invite.test.{uuid.uuid4().hex[:8]}@example.com"
    payload = {
        "email": test_email,
        "role": "member",
        "orgId": org_id
    }

    invite_id = None
    try:
        # Send POST /api/team/invite
        resp = requests.post(f"{base_url}/team/invite", headers=headers, json=payload, timeout=30)
        resp.raise_for_status()
        resp_json = resp.json()

        # Validate response
        assert resp.status_code == 200, f"Expected HTTP 200 but got {resp.status_code}"
        assert isinstance(resp_json, dict), "Response is not a JSON object"
        assert resp_json.get("success") is True, "Response 'success' is not True"
        assert resp_json.get("invite_id"), "Response missing 'invite_id'"
        assert resp_json.get("email") == test_email, "Response email does not match request"
        assert resp_json.get("role") == payload["role"], "Response role does not match request"
        assert "expires_at" in resp_json, "Response missing 'expires_at'"
        assert resp_json.get("email_sent") is True, "Response 'email_sent' is not True"

        invite_id = resp_json.get("invite_id")
    finally:
        # Cleanup: There is no direct API described to delete an invite. In real cases, that would be done here.
        pass

test_post_api_team_invite_with_valid_email()
