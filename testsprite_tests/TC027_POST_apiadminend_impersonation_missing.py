import requests

base_url = "http://localhost:3000/api"


def test_post_api_admin_end_impersonation_missing():
    url = f"{base_url}/admin/end-impersonation"
    headers = {'Content-Type': 'application/json'}
    json_body = {}

    try:
        response = requests.post(url, json=json_body, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 400, f"Expected status code 400 but got {response.status_code}"
    

test_post_api_admin_end_impersonation_missing()