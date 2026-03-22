import requests

BASE_URL = "http://localhost:3000/api"

def test_post_api_compliance_verify_no_file():
    url = f"{BASE_URL}/compliance/verify"

    try:
        # Send POST with empty multipart form (no file)
        response = requests.post(url, files={}, timeout=30)

        # Assert status code 400
        assert response.status_code == 400, f"Expected status 400, got {response.status_code}"

        # Assert response text or json contains indication of missing file
        # Try to parse JSON response if possible
        try:
            resp_json = response.json()
            # Check that message or error substring includes indication of missing file
            assert any(keyword in str(resp_json).lower() for keyword in ['no file', 'missing file', 'file']), \
                f"Response JSON does not indicate missing file: {resp_json}"
        except ValueError:
            # Not JSON, check text content
            assert any(keyword in response.text.lower() for keyword in ['no file', 'missing file', 'file']), \
                f"Response text does not indicate missing file: {response.text}"
    except requests.RequestException as e:
        assert False, f"Request to {url} failed: {str(e)}"

test_post_api_compliance_verify_no_file()