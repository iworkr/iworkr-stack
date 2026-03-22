import requests

def test_post_api_compliance_verify_with_file_upload():
    url = "http://localhost:3000/api/compliance/verify"
    files = {
        'file': ('testfile.txt', b'This is test content for compliance verification.', 'text/plain')
    }
    try:
        response = requests.post(url, files=files, timeout=30)
        assert response.status_code == 200, f"Expected status 200, got {response.status_code}"
        json_resp = response.json()
        assert 'authentic' in json_resp, "'authentic' not in response"
        assert 'sha256_hash' in json_resp, "'sha256_hash' not in response"
        assert 'record' in json_resp, "'record' not in response"
        assert 'message' in json_resp, "'message' not in response"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_post_api_compliance_verify_with_file_upload()
