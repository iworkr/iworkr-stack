import requests

BASE_URL = "http://localhost:3000/api"

def test_post_signup_invite_missing_fields():
    url = f"{BASE_URL}/team/signup-invite"
    headers = {
        'Content-Type': 'application/json'
    }
    try:
        response = requests.post(url, json={}, headers=headers, timeout=30)
        assert response.status_code == 400, f"Expected status code 400 but got {response.status_code}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_post_signup_invite_missing_fields()