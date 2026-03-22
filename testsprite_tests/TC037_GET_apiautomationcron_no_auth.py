import requests

BASE_URL = "http://localhost:3000/api"

def test_get_automation_cron_no_auth():
    url = f"{BASE_URL}/automation/cron"
    try:
        response = requests.get(url, timeout=30)
        assert response.status_code == 401, f"Expected 401 Unauthorized but got {response.status_code}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_get_automation_cron_no_auth()