import requests

def test_post_api_automation_execute_no_auth():
    base_url = "http://localhost:3000/api"
    url = f"{base_url}/automation/execute"
    json_body = {"type": "test", "organization_id": "test"}

    try:
        response = requests.post(url, json=json_body, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 401, f"Expected 401 Unauthorized, got {response.status_code}"

test_post_api_automation_execute_no_auth()