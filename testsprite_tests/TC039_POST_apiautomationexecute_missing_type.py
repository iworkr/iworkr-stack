import requests
import json

BASE_URL = "http://localhost:3000/api"


def test_post_api_automation_execute_missing_type():
    # Use the correct secret header as per PRD for authentication
    secret_token = "valid-secret-token-for-test"  # Replace with real secret if known

    url = f"{BASE_URL}/automation/execute"
    headers = {
        "x-secret": secret_token,
        "Content-Type": "application/json"
    }
    payload = {
        # Intentionally missing "type" field
        "organization_id": "00000000-0000-0000-0000-000000000001"
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 400, f"Expected 400 status code, got {response.status_code}. Response body: {response.text}"


test_post_api_automation_execute_missing_type()
