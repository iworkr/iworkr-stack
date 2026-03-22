import requests

BASE_URL = "http://localhost:3000/api"

def test_post_api_compliance_vault_nonexistent_portal():
    url = f"{BASE_URL}/compliance/vault"
    payload = {
        "token": "nonexistent-token",
        "passcode": "wrong",
        "mode": "access"
    }
    try:
        response = requests.post(url, json=payload, timeout=30)
        # Expect 404 about portal not found
        assert response.status_code == 404, f"Expected status code 404, got {response.status_code}"
        # Optionally, parse JSON to check error message if any
        try:
            data = response.json()
            # Check message or error keys if present
            message = data.get("message") or data.get("error") or ""
            assert "not found" in message.lower() or "portal" in message.lower(), "Expected error message mentioning portal not found"
        except ValueError:
            # No JSON response, ignore JSON assertion
            pass
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_post_api_compliance_vault_nonexistent_portal()