import requests

BASE_URL = "http://localhost:3000/api"
TIMEOUT = 30

def test_post_stripe_create_subscription_no_auth():
    url = f"{BASE_URL}/stripe/create-subscription"
    payload = {
        "priceId": "price_test",
        "orgId": "test"
    }
    headers = {
        "Content-Type": "application/json"
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"
    assert response.status_code == 401, f"Expected status code 401, got {response.status_code}"

test_post_stripe_create_subscription_no_auth()