import requests
import datetime

BASE_API_URL = "http://localhost:3000/api"
SUPABASE_AUTH_URL = "https://olqjuadvseoxpfjzlghb.supabase.co/auth/v1/token?grant_type=password"
SUPABASE_APIKEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"  # Placeholder, replace if actual key provided
SUPABASE_EMAIL = "testsprite-qa@iworkrapp.com"
SUPABASE_PASSWORD = "TestSprite2026!"

def get_auth_token():
    headers = {
        "apikey": SUPABASE_APIKEY,
        "Content-Type": "application/json"
    }
    json_body = {
        "email": SUPABASE_EMAIL,
        "password": SUPABASE_PASSWORD
    }
    response = requests.post(SUPABASE_AUTH_URL, headers=headers, json=json_body, timeout=30)
    response.raise_for_status()
    data = response.json()
    token = data.get("access_token")
    assert token, "Authentication failed: access_token missing"
    return token

def test_post_api_schedule_validate_with_valid_schedule_block():
    # Authenticate and get token
    token = get_auth_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # Prepare a valid schedule block payload
    # Using org ID from test metadata and assumed valid technician id
    organization_id = "00000000-0000-0000-0000-000000000001"
    technician_id = "00000000-0000-0000-0000-000000000002"  # Example technician ID for testing

    # Create a valid future time block for start_time and end_time in ISO 8601 format
    # e.g., start_time now + 1 hour, end_time +2 hours
    now = datetime.datetime.utcnow()
    start_time = (now + datetime.timedelta(hours=1)).isoformat() + "Z"
    end_time = (now + datetime.timedelta(hours=2)).isoformat() + "Z"

    payload = {
        "organization_id": organization_id,
        "technician_id": technician_id,
        "start_time": start_time,
        "end_time": end_time
    }

    url = f"{BASE_API_URL}/schedule/validate"
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    resp_json = response.json()

    # Validate response structure and values according to PRD response schema
    assert response.status_code == 200, f"Expected status 200 but got {response.status_code}"
    assert isinstance(resp_json, dict), "Response is not a JSON object"
    assert "valid" in resp_json, "'valid' field missing in response"
    assert resp_json["valid"] is True, "Expected valid: true indicating no conflicts"
    assert "conflicts" in resp_json, "'conflicts' field missing in response"
    assert isinstance(resp_json["conflicts"], list), "'conflicts' is not a list"
    assert len(resp_json["conflicts"]) == 0, "Expected no conflicts, but conflicts found"
    assert "travel" in resp_json, "'travel' field missing in response"
    # travel can be any type, no detailed schema provided - so just check existence
    assert "warnings" in resp_json, "'warnings' field missing in response"
    assert isinstance(resp_json["warnings"], list), "'warnings' is not a list"

test_post_api_schedule_validate_with_valid_schedule_block()