import requests

def test_post_api_stripe_create_subscription_no_auth():
    base_url = "http://localhost:3000/api"
    url = f"{base_url}/stripe/create-subscription"
    payload = {
        "priceId": "price_test",
        "orgId": "00000000-0000-0000-0000-000000000001"
    }
    headers = {
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 401, f"Expected status 401 but got {response.status_code}"

test_post_api_stripe_create_subscription_no_auth()