import requests

BASE_URL = "http://localhost:3000/api"

def test_get_compliance_dossier_no_auth():
    params = {
        "organization_id": "test",
        "date_start": "2026-01-01",
        "date_end": "2026-03-21"
    }
    try:
        response = requests.get(
            f"{BASE_URL}/compliance/dossier",
            params=params,
            timeout=30
        )
        assert response.status_code == 401, f"Expected status code 401 but got {response.status_code}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_get_compliance_dossier_no_auth()