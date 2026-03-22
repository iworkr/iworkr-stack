import requests

def test_get_api_compliance_dossier_no_auth():
    base_url = "http://localhost:3000/api"
    params = {
        "organization_id": "00000000-0000-0000-0000-000000000001",
        "date_start": "2026-01-01",
        "date_end": "2026-03-21"
    }
    try:
        response = requests.get(f"{base_url}/compliance/dossier", params=params, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed with exception: {e}"
    
    # Expect 401 Unauthorized since no auth cookies were provided
    assert response.status_code == 401, f"Expected 401 Unauthorized, got {response.status_code}"
    # Optionally check response text or json for "Not authenticated"
    try:
        data = response.json()
        assert "Not authenticated" in (data.get("message", "") + data.get("error", "")) or "not authenticated" in (data.get("message", "").lower() + data.get("error", "").lower()), \
            "Expected 'Not authenticated' message in response."
    except Exception:
        # If response is not JSON, skip message check
        pass

test_get_api_compliance_dossier_no_auth()