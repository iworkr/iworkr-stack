import requests

def test_get_nonexistent_client_statement_no_auth():
    base_url = "http://localhost:3000/api"
    client_id = "00000000-0000-0000-0000-000000000099"
    url = f"{base_url}/clients/{client_id}/statement"
    try:
        response = requests.get(url, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"
    assert response.status_code == 401, f"Expected status code 401, got {response.status_code}"
    # Optional: check body content for "Not authenticated" message if any
    # But PRD notes just status code check is mandatory here

test_get_nonexistent_client_statement_no_auth()