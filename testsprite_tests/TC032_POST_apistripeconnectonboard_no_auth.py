import requests

BASE_URL = "http://localhost:3000/api"

def test_post_stripe_connect_onboard_no_auth():
    url = f"{BASE_URL}/stripe/connect/onboard"
    json_payload = {"orgId": "test"}
    try:
        response = requests.post(url, json=json_payload, timeout=30)
        # Expecting 401 Unauthorized response due to missing cookies/auth
        assert response.status_code == 401, f"Expected 401, got {response.status_code} with response: {response.text}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_post_stripe_connect_onboard_no_auth()