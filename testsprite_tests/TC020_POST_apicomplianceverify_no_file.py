import requests

BASE_URL = "http://localhost:3000/api"


def test_post_api_compliance_verify_no_file():
    url = f"{BASE_URL}/compliance/verify"
    # Send empty multipart form (no file)
    response = requests.post(url, files={}, timeout=30)

    assert response.status_code == 400, f"Expected status 400 but got {response.status_code}"
    try:
        data = response.json()
        # The error message should indicate no file provided
        assert "file" in data.get("message", "").lower() or "no file" in data.get("message", "").lower()
    except Exception:
        # If response is not JSON, that's unexpected for 400
        assert False, "Response was not JSON"


test_post_api_compliance_verify_no_file()