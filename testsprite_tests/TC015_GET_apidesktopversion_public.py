import requests

BASE_ENDPOINT = "http://localhost:3000/api"


def test_get_api_desktop_version_public():
    url = f"{BASE_ENDPOINT}/desktop/version"
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        data = response.json()
        assert isinstance(data, dict), "Response JSON is not a dictionary"
        # Check required fields exist
        assert "version" in data, "Missing 'version' in response"
        assert "releaseDate" in data, "Missing 'releaseDate' in response"
        assert "macArmUrl" in data, "Missing 'macArmUrl' in response"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"


test_get_api_desktop_version_public()