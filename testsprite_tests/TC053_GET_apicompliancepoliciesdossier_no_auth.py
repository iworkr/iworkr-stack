import requests

def test_get_compliance_policies_dossier_no_auth():
    base_url = "http://localhost:3000/api"
    endpoint = f"{base_url}/compliance/policies/dossier"
    params = {
        "policy_id": "test",
        "organization_id": "test"
    }
    try:
        response = requests.get(endpoint, params=params, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code in (400, 401), f"Expected status 400 or 401, got {response.status_code}"
    
test_get_compliance_policies_dossier_no_auth()
