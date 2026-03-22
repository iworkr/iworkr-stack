import requests

BASE_URL = 'http://localhost:3000/api'

def test_post_api_automation_cron_no_auth():
    url = f'{BASE_URL}/automation/cron'
    try:
        response = requests.get(url, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 401, f"Expected 401 Unauthorized, got {response.status_code}"

test_post_api_automation_cron_no_auth()