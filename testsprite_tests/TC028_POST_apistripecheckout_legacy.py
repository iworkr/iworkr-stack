import requests

BASE_URL = "http://localhost:3000/api"

def test_post_api_stripe_checkout_legacy():
    url = f"{BASE_URL}/stripe/checkout"
    try:
        response = requests.post(url, json={}, timeout=30)
        assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
        resp_json = response.json()
        assert isinstance(resp_json, dict), "Response is not a JSON object"
        assert "url" in resp_json, "'url' key missing in response JSON"
        assert isinstance(resp_json["url"], str) and resp_json["url"].startswith("http"), "'url' is not a valid string URL"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_post_api_stripe_checkout_legacy()