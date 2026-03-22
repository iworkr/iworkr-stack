import requests

BASE_URL = "http://localhost:3000/api"

def test_post_notifications_register_device_no_auth():
    url = f"{BASE_URL}/notifications/register-device"
    payload = {
        "fcm_token": "test",
        "device_type": "web"
    }
    headers = {
        "Content-Type": "application/json"
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        assert response.status_code == 401, f"Expected 401 Unauthorized but got {response.status_code}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_post_notifications_register_device_no_auth()