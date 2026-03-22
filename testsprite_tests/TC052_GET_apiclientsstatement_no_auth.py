import requests

BASE_URL = "http://localhost:3000/api"
CLIENT_ID = "00000000-0000-0000-0000-000000000099"
TIMEOUT = 30

def test_get_client_statement_no_auth():
    url = f"{BASE_URL}/clients/{CLIENT_ID}/statement"
    try:
        response = requests.get(url, timeout=TIMEOUT)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"
    assert response.status_code == 401, f"Expected 401 Unauthorized but got {response.status_code}"

test_get_client_statement_no_auth()