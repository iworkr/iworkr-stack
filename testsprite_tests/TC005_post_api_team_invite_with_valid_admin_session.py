import requests

BASE_URL = "http://localhost:3000/api"
INVITE_ENDPOINT = f"{BASE_URL}/team/invite"
USER_ORG_ENDPOINT = f"{BASE_URL}/user/organization"
HEADERS = {
    "Content-Type": "application/json",
}
TIMEOUT = 30

# Replace this with a valid admin session cookie string value
ADMIN_SESSION_COOKIE = "session=valid-admin-session-cookie-value"


def test_post_api_team_invite_with_valid_admin_session():
    session = requests.Session()
    session.headers.update(HEADERS)
    session.cookies.set("session", ADMIN_SESSION_COOKIE.split("session=")[1])

    # Prepare request body with dynamic email to avoid conflicts
    import uuid
    email = f"testuser-{uuid.uuid4().hex[:8]}@example.com"
    role = "team_member"

    payload = {
        "email": email,
        "role": role
    }

    try:
        resp = session.post(INVITE_ENDPOINT, json=payload, timeout=TIMEOUT)
        assert resp.status_code == 200, f"Expected 200 OK but got {resp.status_code}"
        resp_json = resp.json()
        # Validate response body fields
        assert "success" in resp_json and resp_json["success"] is True, "Missing or false success flag"
        assert "invite_id" in resp_json and isinstance(resp_json["invite_id"], (str, int)), "Missing invite_id"
        assert resp_json.get("email") == email, "Response email does not match request"
        assert resp_json.get("role") == role, "Response role does not match request"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"


test_post_api_team_invite_with_valid_admin_session()