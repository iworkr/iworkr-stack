import requests

def test_post_api_team_invite_no_auth():
    base_url = "http://localhost:3000/api"
    url = f"{base_url}/team/invite"
    payload = {
        "email": "test@example.com",
        "role": "worker"
    }
    headers = {
        "Content-Type": "application/json"
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        assert response.status_code == 401, f"Expected status code 401 but got {response.status_code}. Response text: {response.text}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_post_api_team_invite_no_auth()