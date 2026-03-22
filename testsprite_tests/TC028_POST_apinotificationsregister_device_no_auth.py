import requests

def test_post_notifications_register_device_no_auth():
    base_url = "http://localhost:3000/api"
    url = f"{base_url}/notifications/register-device"
    payload = {
        "fcm_token": "test",
        "device_type": "web"
    }
    headers = {
        "Content-Type": "application/json"
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        assert response.status_code == 401, f"Expected 401 Unauthorized, got {response.status_code}. Response: {response.text}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_post_notifications_register_device_no_auth()