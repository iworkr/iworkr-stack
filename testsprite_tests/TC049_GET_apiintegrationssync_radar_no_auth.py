import requests

BASE_URL = "http://localhost:3000/api"

def test_get_integrations_sync_radar_no_auth():
    try:
        response = requests.get(
            f"{BASE_URL}/integrations/sync-radar",
            params={"orgId": "test"},
            timeout=30
        )
        assert response.status_code == 401, f"Expected 401 Unauthorized but got {response.status_code}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_get_integrations_sync_radar_no_auth()