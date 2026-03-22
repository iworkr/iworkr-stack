import requests
import json

BASE_URL = "http://localhost:3000/api"

def test_post_api_compliance_verify_with_file_upload():
    url = f"{BASE_URL}/compliance/verify"
    files = {
        'file': ('test.txt', b'Hello World test content', 'text/plain')
    }
    try:
        response = requests.post(url, files=files, timeout=30)
        assert response.status_code == 200, f"Expected status 200 but got {response.status_code}"
        # Parse JSON response
        result = response.json()
        assert 'authentic' in result, "'authentic' field missing in response"
        assert isinstance(result['authentic'], bool), "'authentic' is not boolean"
        assert 'sha256_hash' in result, "'sha256_hash' field missing in response"
        sha256_hash = result['sha256_hash']
        assert isinstance(sha256_hash, str), "'sha256_hash' is not string"
        assert len(sha256_hash) == 64, "'sha256_hash' length is not 64 characters"
        assert 'record' in result, "'record' field missing in response"
        assert (result['record'] is None) or isinstance(result['record'], dict), "'record' is neither None nor object"
        assert 'message' in result, "'message' field missing in response"
        assert isinstance(result['message'], str), "'message' is not string"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"
    except json.JSONDecodeError:
        assert False, "Response is not a valid JSON"

test_post_api_compliance_verify_with_file_upload()
