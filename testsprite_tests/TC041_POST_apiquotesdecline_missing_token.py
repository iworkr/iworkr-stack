import requests

BASE_URL = "http://localhost:3000/api"

def test_post_quotes_decline_missing_token():
    url = f"{BASE_URL}/quotes/00000000-0000-0000-0000-000000000099/decline"
    try:
        response = requests.post(url, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed with exception: {e}"
    assert response.status_code == 401, f"Expected 401 Unauthorized, got {response.status_code}"

test_post_quotes_decline_missing_token()