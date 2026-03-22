import requests
import json

BASE_URL = "http://localhost:3000/api"

def test_post_api_stripe_portal_no_auth():
    url = f"{BASE_URL}/stripe/portal"
    payload = {"orgId": "test"}
    headers = {"Content-Type": "application/json"}

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 401, f"Expected status code 401 but got {response.status_code}"
    try:
        # Response may or may not include JSON body, if it does, confirm contains authorization error info
        resp_json = response.json()
        # Optionally check for error keys/messages if present
        assert 'error' in resp_json or 'message' in resp_json or not resp_json, "Expected error info in JSON response"
    except Exception:
        # If no JSON returned, this is acceptable for 401
        pass

test_post_api_stripe_portal_no_auth()