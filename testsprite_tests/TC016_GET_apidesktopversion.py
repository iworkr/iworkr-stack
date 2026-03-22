import requests

BASE_URL = "http://localhost:3000/api"

def test_get_desktop_version_no_auth():
    url = f"{BASE_URL}/desktop/version"
    try:
        response = requests.get(url, timeout=30)
        assert response.status_code == 200, f"Expected status 200 but got {response.status_code}"
        json_data = response.json()
        expected_fields = [
            "version",
            "releaseDate",
            "macArmUrl",
            "macIntelUrl",
            "winUrl",
            "linuxUrl"
        ]
        for field in expected_fields:
            assert field in json_data, f"Missing expected field '{field}' in response JSON"
            assert isinstance(json_data[field], str), f"Field '{field}' should be a string"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_get_desktop_version_no_auth()