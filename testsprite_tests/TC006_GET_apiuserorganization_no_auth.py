import requests

BASE_URL = 'http://localhost:3000/api'

def test_get_user_organization_no_auth():
    url = f"{BASE_URL}/user/organization"
    try:
        response = requests.get(url, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"
    assert response.status_code == 401, f"Expected 401 Unauthorized but got {response.status_code}"

test_get_user_organization_no_auth()