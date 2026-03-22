import requests

def test_post_stripe_connect_payment_intent_no_auth():
    base_url = "http://localhost:3000/api"
    url = f"{base_url}/stripe/connect/payment-intent"
    payload = {
        "invoiceId": "test",
        "orgId": "test",
        "amountCents": 1000
    }
    try:
        response = requests.post(url, json=payload, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 401, f"Expected 401 Unauthorized but got {response.status_code}"
    # Optionally check error message if present and JSON response
    try:
        json_resp = response.json()
        assert "Not authenticated" in (json_resp.get("message", "") or json_resp.get("error", "") or ""), \
            f"Unexpected error message: {json_resp}"
    except Exception:
        # If response is not JSON, it's acceptable as 401 message is checked by status code
        pass

test_post_stripe_connect_payment_intent_no_auth()