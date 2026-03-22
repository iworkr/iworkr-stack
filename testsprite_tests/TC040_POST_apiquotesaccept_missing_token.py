import requests

BASE_URL = "http://localhost:3000/api"
QUOTE_ID = "00000000-0000-0000-0000-000000000099"
TIMEOUT = 30

def test_post_quote_accept_missing_token_no_auth():
    url = f"{BASE_URL}/quotes/{QUOTE_ID}/accept"
    try:
        response = requests.post(url, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"
    assert response.status_code == 401, f"Expected 401 Unauthorized, got {response.status_code}"

test_post_quote_accept_missing_token_no_auth()