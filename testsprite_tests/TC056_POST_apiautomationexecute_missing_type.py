import requests

BASE_ENDPOINT = "http://localhost:3000/api"
AUTOMATION_EXECUTE_URL = f"{BASE_ENDPOINT}/automation/execute"
AUTOMATION_SECRET = "invalid-or-missing-secret"  # Intentionally invalid as CRON_SECRET not accessible
ORG_ID = "00000000-0000-0000-0000-000000000001"

def test_post_automation_execute_missing_type():
    headers = {
        "Authorization": f"Bearer {AUTOMATION_SECRET}",
        "Content-Type": "application/json"
    }
    # Body missing 'type', only includes organization_id
    payload = {
        "organization_id": ORG_ID
    }

    try:
        response = requests.post(
            AUTOMATION_EXECUTE_URL,
            headers=headers,
            json=payload,
            timeout=30
        )
    except requests.RequestException as e:
        assert False, f"Request failed with exception: {e}"

    # Expect 400 Bad Request due to missing 'type' field
    assert response.status_code == 400, f"Expected status code 400, got {response.status_code}"