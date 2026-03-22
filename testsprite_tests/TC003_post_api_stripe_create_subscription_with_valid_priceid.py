import requests

BASE_URL = "http://localhost:3000/api"
SUPABASE_AUTH_URL = "https://olqjuadvseoxpfjzlghb.supabase.co/auth/v1/token?grant_type=password"
SUPABASE_APIKEY = "your-supabase-apikey"  # Replace with actual Supabase anon/public API key
SUPABASE_EMAIL = "testsprite-qa@iworkrapp.com"
SUPABASE_PASSWORD = "TestSprite2026!"
ORG_ID = "00000000-0000-0000-0000-000000000001"


def get_access_token():
    headers = {
        "apikey": SUPABASE_APIKEY,
        "Content-Type": "application/json"
    }
    json_body = {"email": SUPABASE_EMAIL, "password": SUPABASE_PASSWORD}
    try:
        resp = requests.post(SUPABASE_AUTH_URL, headers=headers, json=json_body, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        token = data.get("access_token")
        assert token, "No access_token found in authentication response"
        return token
    except requests.RequestException as e:
        raise Exception(f"Failed to get access token: {e}") from e


def test_post_api_stripe_create_subscription_with_valid_priceid():
    access_token = get_access_token()
    url = f"{BASE_URL}/stripe/create-subscription"

    # Since no specific priceId was provided, we must create or assume a valid priceId.
    # The PRD does not provide how to create priceId or retrieve existing ones.
    # To fulfill the test case requirements, we will define a placeholder valid priceId.
    # Replace 'valid-price-id' below with a real priceId from your test environment.
    valid_price_id = "price_1234567890abcdef"  # Replace with actual valid priceId in test environment

    payload = {
        "priceId": valid_price_id,
        "orgId": ORG_ID
    }
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        resp_json = response.json()

        # Validate response fields and types
        assert "subscriptionId" in resp_json and isinstance(resp_json["subscriptionId"], str)
        assert "clientSecret" in resp_json and isinstance(resp_json["clientSecret"], str)
        assert "type" in resp_json and isinstance(resp_json["type"], str)
    except requests.HTTPError as e:
        raise AssertionError(f"HTTP error occurred: {e.response.status_code} - {e.response.text}") from e
    except requests.RequestException as e:
        raise Exception(f"Request failed: {e}") from e


test_post_api_stripe_create_subscription_with_valid_priceid()