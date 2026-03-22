import requests

BASE_URL = "http://localhost:3000/api"
TIMEOUT = 30

def test_post_api_revalidate_invalid_secret():
    url = f"{BASE_URL}/revalidate"
    payload = {
        "path": "/dashboard",
        "secret": "wrong"
    }
    headers = {
        "Content-Type": "application/json"
    }

    response = requests.post(url, json=payload, headers=headers, timeout=TIMEOUT)

    assert response.status_code == 401, f"Expected status code 401, got {response.status_code}"
    # Optionally check response content for error message if available
    # Example:
    # response_json = response.json()
    # assert "error" in response_json or "message" in response_json

test_post_api_revalidate_invalid_secret()