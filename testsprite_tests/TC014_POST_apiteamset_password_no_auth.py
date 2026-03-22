import requests

def test_post_team_set_password_no_auth():
    base_url = "http://localhost:3000/api"
    url = f"{base_url}/team/set-password"
    payload = {
        "userId": "00000000-0000-0000-0000-000000000001",
        "password": "NewPassword123!"
    }
    headers = {
        "Content-Type": "application/json"
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        assert response.status_code == 401, f"Expected status code 401 but got {response.status_code}"
        # Optionally check error message if returned as JSON or text
        # but per instructions, 401 is primary
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_post_team_set_password_no_auth()