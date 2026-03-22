import requests

def test_post_quotes_nonexistent_decline_missing_token():
    base_url = "http://localhost:3000/api"
    quote_id = "00000000-0000-0000-0000-000000000099"
    url = f"{base_url}/quotes/{quote_id}/decline"
    try:
        response = requests.post(url, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    # Expect 401 Unauthorized about missing token query param
    assert response.status_code == 401, f"Expected status 401, got {response.status_code}"

    try:
        json_resp = response.json()
    except ValueError:
        assert False, "Response is not JSON"

    assert "token" in str(json_resp).lower() or "missing" in str(json_resp).lower(), \
        f"Expected error message about missing token, got: {json_resp}"

test_post_quotes_nonexistent_decline_missing_token()