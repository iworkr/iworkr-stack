import requests

BASE_URL = "http://localhost:3000/api"
SUPABASE_AUTH_URL = "https://olqjuadvseoxpfjzlghb.supabase.co/auth/v1/token?grant_type=password"
SUPABASE_API_KEY = "your_supabase_anon_api_key"  # Replace with actual key if available
EMAIL = "testsprite-qa@iworkrapp.com"
PASSWORD = "TestSprite2026!"

def get_access_token():
    headers = {
        "apikey": SUPABASE_API_KEY,
        "Content-Type": "application/json"
    }
    json_data = {
        "email": EMAIL,
        "password": PASSWORD
    }
    resp = requests.post(SUPABASE_AUTH_URL, json=json_data, headers=headers, timeout=30)
    resp.raise_for_status()
    token_data = resp.json()
    access_token = token_data.get("access_token")
    assert access_token, "Access token missing in auth response"
    return access_token

def test_post_api_notifications_register_device_with_valid_fcm_token():
    access_token = get_access_token()
    url = f"{BASE_URL}/notifications/register-device"
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    payload = {
        "fcm_token": "valid_dummy_fcm_token_1234567890",
        "device_type": "android"
    }
    response = requests.post(url, json=payload, headers=headers, timeout=30)
    try:
        response.raise_for_status()
    except requests.HTTPError:
        assert False, f"API returned HTTP error: {response.status_code} - {response.text}"
    json_resp = response.json()
    assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
    assert "success" in json_resp, "Response missing 'success' field"
    assert json_resp["success"] is True, f"Expected success true, got {json_resp['success']}"

test_post_api_notifications_register_device_with_valid_fcm_token()