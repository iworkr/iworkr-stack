import requests

def test_post_stripe_connect_onboard_no_auth():
    base_url = "http://localhost:3000/api"
    url = f"{base_url}/stripe/connect/onboard"
    payload = {"orgId": "00000000-0000-0000-0000-000000000001"}

    try:
        response = requests.post(url, json=payload, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 401, f"Expected 401 Unauthorized but got {response.status_code}"

test_post_stripe_connect_onboard_no_auth()