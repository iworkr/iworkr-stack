import requests

def test_post_api_team_signup_invite_missing_fields():
    base_url = 'http://localhost:3000/api'
    url = f'{base_url}/team/signup-invite'
    headers = {'Content-Type': 'application/json'}
    try:
        response = requests.post(url, json={}, headers=headers, timeout=30)
    except requests.RequestException as e:
        raise AssertionError(f"Request failed: {e}")

    assert response.status_code == 400, f"Expected status code 400 but got {response.status_code}"
    # The error message is expected about missing fields
    # Try to parse JSON and check error content if possible
    try:
        data = response.json()
        assert any(keyword in str(data).lower() for keyword in ['missing', 'fields', 'required']), \
            f"Expected error message about missing fields, got response: {data}"
    except ValueError:
        # Response is not JSON, just ensure status code is 400
        pass

test_post_api_team_signup_invite_missing_fields()