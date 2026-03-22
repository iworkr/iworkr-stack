import requests

def test_post_stripe_connect_payment_intent_no_auth():
    base_url = "http://localhost:3000/api"
    url = f"{base_url}/stripe/connect/payment-intent"
    payload = {
        "invoiceId": "test",
        "orgId": "test",
        "amountCents": 1000
    }
    headers = {
        "Content-Type": "application/json"
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
    except requests.RequestException as e:
        raise AssertionError(f"Request failed: {e}")
    assert response.status_code == 401, f"Expected status code 401, got {response.status_code}"
test_post_stripe_connect_payment_intent_no_auth()