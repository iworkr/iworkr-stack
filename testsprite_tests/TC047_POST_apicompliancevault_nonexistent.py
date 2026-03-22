import requests

BASE_URL = "http://localhost:3000/api"

def test_post_api_compliance_vault_nonexistent():
    url = f"{BASE_URL}/compliance/vault"
    payload = {
        "token": "nonexistent-token",
        "passcode": "wrong",
        "mode": "access"
    }
    headers = {"Content-Type": "application/json"}

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        assert response.status_code == 404, f"Expected status code 404 but got {response.status_code}. Response text: {response.text}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_post_api_compliance_vault_nonexistent()