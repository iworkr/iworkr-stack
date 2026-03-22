import requests

BASE_ENDPOINT = 'http://localhost:3000/api'

def test_post_api_compliance_verify_with_file():
    url = f'{BASE_ENDPOINT}/compliance/verify'
    files = {'file': ('test.txt', b'Hello World', 'text/plain')}
    try:
        response = requests.post(url, files=files, timeout=30)
        response.raise_for_status()
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Expected status code 200, got {response.status_code}"

    try:
        json_data = response.json()
    except ValueError:
        assert False, "Response is not valid JSON"

    # Validate keys presence
    assert 'authentic' in json_data, "Missing 'authentic' in response"
    assert isinstance(json_data['authentic'], bool), "'authentic' is not boolean"

    assert 'sha256_hash' in json_data, "Missing 'sha256_hash' in response"
    assert isinstance(json_data['sha256_hash'], str), "'sha256_hash' is not string"

    assert 'record' in json_data, "Missing 'record' in response"
    # record can be object or null (None)
    assert json_data['record'] is None or isinstance(json_data['record'], dict), "'record' is not object or null"

    assert 'message' in json_data, "Missing 'message' in response"
    assert isinstance(json_data['message'], str), "'message' is not string"

test_post_api_compliance_verify_with_file()
