import requests

BASE_URL = "http://localhost:3000/api"

def test_post_api_stripe_checkout_legacy():
    url = f"{BASE_URL}/stripe/checkout"
    try:
        response = requests.post(url, json={}, timeout=30)
        assert response.status_code == 200, f"Expected status 200 but got {response.status_code}"
        json_resp = response.json()
        assert "url" in json_resp, "Response JSON missing 'url' field"
        assert isinstance(json_resp["url"], str), "'url' field is not a string"
        assert "/checkout" in json_resp["url"], f"'url' does not contain '/checkout': {json_resp['url']}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_post_api_stripe_checkout_legacy()