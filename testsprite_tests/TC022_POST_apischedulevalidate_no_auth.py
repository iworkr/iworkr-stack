import requests

BASE_URL = "http://localhost:3000/api"

def test_post_schedule_validate_no_auth():
    url = f"{BASE_URL}/schedule/validate"
    payload = {
        "organization_id": "00000000-0000-0000-0000-000000000001",
        "technician_id": "1136cf07-0c68-47fd-ad5a-a3cab2beab14",
        "start_time": "2026-04-01T09:00:00Z",
        "end_time": "2026-04-01T10:00:00Z"
    }
    try:
        response = requests.post(url, json=payload, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 401, f"Expected 401 Unauthorized, got {response.status_code}"
    try:
        # Optionally check response content or message for auth error
        data = response.json()
    except Exception:
        data = None

test_post_schedule_validate_no_auth()