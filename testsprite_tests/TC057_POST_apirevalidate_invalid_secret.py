import requests

def test_post_api_revalidate_invalid_secret():
    url = "http://localhost:3000/api/revalidate"
    payload = {
        "path": "/dashboard",
        "secret": "wrong-secret"
    }
    headers = {
        "Content-Type": "application/json",
    }
    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 401, f"Expected status 401 but got {response.status_code}"
    try:
        json_resp = response.json()
    except Exception:
        json_resp = None
    # The error message about invalid secret is expected in the response body,
    # but since not specified exact message, just assert 401 status code is sufficient.

test_post_api_revalidate_invalid_secret()