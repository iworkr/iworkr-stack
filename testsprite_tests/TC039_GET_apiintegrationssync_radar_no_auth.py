import requests

BASE_URL = 'http://localhost:3000/api'

def test_get_integrations_sync_radar_no_auth():
    params = {'orgId': '00000000-0000-0000-0000-000000000001'}
    url = f"{BASE_URL}/integrations/sync-radar"
    try:
        response = requests.get(url, params=params, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"
    assert response.status_code == 401, f"Expected 401 Unauthorized, got {response.status_code}"

test_get_integrations_sync_radar_no_auth()