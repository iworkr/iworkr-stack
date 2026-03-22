import requests

BASE_URL = "http://localhost:3000/api"

def test_post_stripe_webhook_missing_signature():
    url = f"{BASE_URL}/stripe/webhook"
    headers = {
        "Content-Type": "text/plain"
        # Intentionally no 'stripe-signature' header included
    }
    data = "test"

    try:
        response = requests.post(url, headers=headers, data=data, timeout=30)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}. Response text: {response.text}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_post_stripe_webhook_missing_signature()