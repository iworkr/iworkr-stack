import requests
import json

BASE_URL = "http://localhost:3000/api"

def test_post_webhooks_gohighlevel_missing_type():
    url = f"{BASE_URL}/webhooks/gohighlevel"
    headers = {'Content-Type': 'application/json'}
    payload = {}

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 400, f"Expected status 400, got {response.status_code}"
    # Optionally check response content for error message
    try:
        resp_json = response.json()
        assert isinstance(resp_json, dict)
    except (ValueError, json.JSONDecodeError):
        # If response not JSON, that's acceptable as 400 may return non-JSON
        pass

test_post_webhooks_gohighlevel_missing_type()