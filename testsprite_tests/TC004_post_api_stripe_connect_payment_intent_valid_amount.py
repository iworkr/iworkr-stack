import requests

BASE_URL = "http://localhost:3000/api"
SUPABASE_AUTH_URL = "https://olqjuadvseoxpfjzlghb.supabase.co/auth/v1/token"
SUPABASE_API_KEY = "your-supabase-api-key"  # Replace accordingly if needed
SUPABASE_EMAIL = "testsprite-qa@iworkrapp.com"
SUPABASE_PASSWORD = "TestSprite2026!"

ORG_ID = "00000000-0000-0000-0000-000000000001"

def get_access_token():
    headers = {
        "apikey": SUPABASE_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded"
    }
    data = {
        "grant_type": "password",
        "email": SUPABASE_EMAIL,
        "password": SUPABASE_PASSWORD
    }
    resp = requests.post(SUPABASE_AUTH_URL, headers=headers, data=data, timeout=30)
    resp.raise_for_status()
    data = resp.json()
    assert "access_token" in data and data["access_token"], "No access_token found in auth response"
    return data["access_token"]

def create_invoice(access_token):
    return "00000000-0000-0000-0000-000000000010"

def test_post_api_stripe_connect_payment_intent_valid_amount():
    access_token = get_access_token()
    invoice_id = create_invoice(access_token)
    url = f"{BASE_URL}/stripe/connect/payment-intent"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    payload = {
        "invoiceId": invoice_id,
        "orgId": ORG_ID,
        "amountCents": 1000
    }

    response = None
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        assert response.status_code == 200, f"Expected status 200 but got {response.status_code}. Response: {response.text}"
        resp_json = response.json()
        assert "clientSecret" in resp_json and isinstance(resp_json["clientSecret"], str) and resp_json["clientSecret"], "Missing or invalid clientSecret in response"
        assert "stripeAccountId" in resp_json and isinstance(resp_json["stripeAccountId"], str) and resp_json["stripeAccountId"], "Missing or invalid stripeAccountId in response"
        assert "paymentIntentId" in resp_json and isinstance(resp_json["paymentIntentId"], str) and resp_json["paymentIntentId"], "Missing or invalid paymentIntentId in response"
    finally:
        pass


test_post_api_stripe_connect_payment_intent_valid_amount()