import requests

BASE_URL = "http://localhost:3000/api"

def test_post_api_webhooks_gohighlevel_missing_type():
    url = f"{BASE_URL}/webhooks/gohighlevel"
    headers = {
        "Content-Type": "application/json"
    }
    # No auth needed, so no cookies
    try:
        response = requests.post(url, json={}, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 400, f"Expected status code 400, got {response.status_code}"
    # Check response content has message about missing type or location
    try:
        data = response.json()
    except Exception:
        assert False, "Response is not valid JSON"

    # The error message should mention missing "type" or "location"
    error_message = None
    # Some APIs may put error message under different keys
    for key in ("error", "message", "detail"):
        if key in data:
            error_message = data[key]
            break
    assert error_message is not None, "Error message not found in response JSON"
    assert ("type" in error_message.lower() or "location" in error_message.lower()), \
        f"Error message does not mention missing type or location: {error_message}"

test_post_api_webhooks_gohighlevel_missing_type()