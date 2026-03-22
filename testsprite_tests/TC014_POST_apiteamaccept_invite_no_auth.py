import requests

def test_post_api_team_accept_invite_no_auth():
    base_url = 'http://localhost:3000/api'
    url = f'{base_url}/team/accept-invite'
    payload = {"token": "fake-token"}
    headers = {'Content-Type': 'application/json'}
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        assert response.status_code == 401, f"Expected 401 Unauthorized but got {response.status_code}, response body: {response.text}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_post_api_team_accept_invite_no_auth()