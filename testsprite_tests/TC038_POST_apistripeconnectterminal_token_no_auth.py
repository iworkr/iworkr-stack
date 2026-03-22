import requests

def test_post_stripe_connect_terminal_token_no_auth():
    base_url = "http://localhost:3000/api"
    url = f"{base_url}/stripe/connect/terminal-token"
    payload = {"orgId": "test"}
    headers = {"Content-Type": "application/json"}

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 401, f"Expected status code 401, got {response.status_code}"
    # Optional: Check if response body contains 'Not authenticated'
    try:
        json_response = response.json()
        # It may be text or JSON; if JSON, expect error message or similar
        assert "not authenticated" in str(json_response).lower() or "unauthorized" in str(json_response).lower() or "error" in str(json_response).lower()
    except ValueError:
        # If response is not JSON, no further check
        pass

test_post_stripe_connect_terminal_token_no_auth()