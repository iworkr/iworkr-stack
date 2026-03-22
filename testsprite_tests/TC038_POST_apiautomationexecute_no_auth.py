import requests

def test_post_api_automation_execute_no_auth():
    base_url = "http://localhost:3000/api"
    url = f"{base_url}/automation/execute"
    payload = {"type": "test", "organization_id": "test"}
    headers = {"Content-Type": "application/json"}
    timeout = 30

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=timeout)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 401, f"Expected 401 Unauthorized, got {response.status_code}"
    # Optionally assert response body or message indicating invalid or missing Authorization
    # but PRD states 401 is expected so basic status code check suffices.

test_post_api_automation_execute_no_auth()