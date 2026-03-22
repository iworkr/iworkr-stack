import requests

BASE_URL = "http://localhost:3000/api"

def test_post_api_stripe_webhook_missing_signature():
    url = f"{BASE_URL}/stripe/webhook"
    headers = {
        "Content-Type": "text/plain"
        # Note: Intentionally NOT including 'stripe-signature' header
    }
    data = "test"
    try:
        response = requests.post(url, headers=headers, data=data, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 400, f"Expected 400 status code, got {response.status_code}"
    # Attempt to parse JSON error message if any
    try:
        json_resp = response.json()
        # The error message should mention missing or invalid signature
        err_msg = str(json_resp) or ""
        assert (
            "missing" in err_msg.lower() or "invalid" in err_msg.lower() or "signature" in err_msg.lower()
        ), f"Unexpected error message: {json_resp}"
    except ValueError:
        # Response not JSON, still consider 400 valid if status code is 400
        pass

test_post_api_stripe_webhook_missing_signature()