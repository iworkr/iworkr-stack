import requests

base_url = "http://localhost:3000/api"


def test_post_quote_accept_missing_token():
    quote_id = "00000000-0000-0000-0000-000000000099"
    url = f"{base_url}/quotes/{quote_id}/accept"
    try:
        response = requests.post(url, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 401, f"Expected status 401 but got {response.status_code}"
    try:
        resp_json = response.json()
    except ValueError:
        assert False, "Response is not JSON as expected"

    expected_msg = "A valid secure token is required"
    # The exact key for error message is not specified; check common keys
    msg = None
    for key in ("message", "error", "detail"):
        if key in resp_json:
            msg = resp_json[key]
            break
    assert msg is not None, "No error message found in response JSON"
    assert expected_msg.lower() in msg.lower(), f"Expected error message containing '{expected_msg}', got '{msg}'"


test_post_quote_accept_missing_token()