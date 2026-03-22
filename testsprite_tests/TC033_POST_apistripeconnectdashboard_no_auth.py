import requests

BASE_URL = "http://localhost:3000/api"

def test_post_stripe_connect_dashboard_no_auth():
    url = f"{BASE_URL}/stripe/connect/dashboard"
    payload = {"orgId": "test"}
    headers = {"Content-Type": "application/json"}

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 401, f"Expected status code 401 but got {response.status_code}"

test_post_stripe_connect_dashboard_no_auth()