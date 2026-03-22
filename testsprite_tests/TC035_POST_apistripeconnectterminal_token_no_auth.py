import requests

def test_post_stripe_connect_terminal_token_no_auth():
    base_url = "http://localhost:3000/api"
    url = f"{base_url}/stripe/connect/terminal-token"
    payload = {"orgId": "test"}
    headers = {"Content-Type": "application/json"}

    try:
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        assert response.status_code == 401, f"Expected status code 401, got {response.status_code}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_post_stripe_connect_terminal_token_no_auth()