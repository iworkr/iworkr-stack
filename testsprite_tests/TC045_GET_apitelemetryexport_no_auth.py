import requests

BASE_URL = 'http://localhost:3000/api'

def test_get_telemetry_export_no_auth():
    url = f"{BASE_URL}/telemetry/export"
    try:
        response = requests.get(url, timeout=30)
        # Expect 401 Unauthorized due to missing auth cookies
        assert response.status_code == 401, f"Expected status 401 but got {response.status_code}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_get_telemetry_export_no_auth()