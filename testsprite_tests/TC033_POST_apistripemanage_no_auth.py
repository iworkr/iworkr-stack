import requests

def test_post_api_stripe_manage_no_auth():
    url = "http://localhost:3000/api/stripe/manage"
    json_payload = {
        "action": "cancel",
        "orgId": "00000000-0000-0000-0000-000000000001"
    }
    try:
        response = requests.post(url, json=json_payload, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 401, f"Expected status code 401 but got {response.status_code}"
    try:
        resp_json = response.json()
    except ValueError:
        resp_json = None

    # Optionally check if response contains expected error message for not authenticated
    if resp_json and "message" in resp_json:
        assert "not authenticated" in resp_json["message"].lower()

test_post_api_stripe_manage_no_auth()