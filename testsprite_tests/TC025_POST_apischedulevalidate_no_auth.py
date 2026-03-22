import requests

def test_post_api_schedule_validate_no_auth():
    base_url = 'http://localhost:3000/api'
    url = f'{base_url}/schedule/validate'
    payload = {
        "organization_id": "test",
        "technician_id": "test",
        "start_time": "2026-04-01T09:00:00Z",
        "end_time": "2026-04-01T10:00:00Z"
    }
    headers = {
        "Content-Type": "application/json"
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
    except requests.RequestException as e:
        raise AssertionError(f"Request failed: {e}")

    assert response.status_code == 401, f"Expected status code 401, got {response.status_code}"

test_post_api_schedule_validate_no_auth()