import requests

def test_post_api_team_accept_invite_no_auth():
    base_url = 'http://localhost:3000/api'
    url = f'{base_url}/team/accept-invite'
    payload = {"token": "fake-token"}
    headers = {
        'Content-Type': 'application/json'
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        assert response.status_code == 401, f"Expected status code 401, got {response.status_code}"
        # Optional: check response message if available
        try:
            resp_json = response.json()
            assert 'Not authenticated' in resp_json.get('message', '') or 'Not authenticated' in str(resp_json), "Expected 'Not authenticated' message in response"
        except Exception:
            # Ignore if response not JSON or no message field
            pass
    except requests.RequestException as e:
        assert False, f"Request to {url} failed with exception: {str(e)}"

test_post_api_team_accept_invite_no_auth()