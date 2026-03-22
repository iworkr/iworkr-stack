import requests

BASE_URL = "http://localhost:3000/api"

def test_post_api_compliance_verify_non_multipart():
    url = f"{BASE_URL}/compliance/verify"
    json_body = {"some_key": "some_value"}  # JSON body instead of multipart

    try:
        response = requests.post(url, json=json_body, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request to {url} failed: {e}"

    assert response.status_code == 400, f"Expected 400 for non-multipart JSON body but got {response.status_code}"

test_post_api_compliance_verify_non_multipart()