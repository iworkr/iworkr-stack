import requests

def test_TC048_get_compliance_policies_dossier_no_auth():
    base_url = "http://localhost:3000/api"
    url = f"{base_url}/compliance/policies/dossier"
    params = {
        "policy_id": "test",
        "organization_id": "test"
    }
    try:
        response = requests.get(url, params=params, timeout=30)
        # Expect 401 Unauthorized because no auth cookies sent
        assert response.status_code == 401, f"Expected 401 Unauthorized but got {response.status_code}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_TC048_get_compliance_policies_dossier_no_auth()