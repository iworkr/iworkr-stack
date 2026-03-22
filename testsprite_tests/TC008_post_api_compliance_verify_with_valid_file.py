import requests
import hashlib

def test_post_api_compliance_verify_with_valid_file():
    base_url = "http://localhost:3000/api"
    url = f"{base_url}/compliance/verify"
    timeout = 30

    # We need a valid file for upload.
    # Create a small example PDF binary as valid file content (PDF header+trailer minimal)
    pdf_content = b"%PDF-1.4\n%EOF\n"
    files = {'file': ('test_document.pdf', pdf_content, 'application/pdf')}

    try:
        response = requests.post(url, files=files, timeout=timeout)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

    assert response.status_code == 200, f"Expected status 200, got {response.status_code}"

    json_resp = None
    try:
        json_resp = response.json()
    except Exception as e:
        assert False, f"Response is not valid JSON: {e}"

    # Validate required keys
    assert "authentic" in json_resp, "'authentic' key missing in response"
    assert isinstance(json_resp["authentic"], bool), "'authentic' should be boolean"
    assert "sha256_hash" in json_resp, "'sha256_hash' key missing in response"
    assert isinstance(json_resp["sha256_hash"], str) and len(json_resp["sha256_hash"]) == 64, "'sha256_hash' should be a 64-character string"
    assert "record" in json_resp, "'record' key missing in response"
    assert "message" in json_resp and isinstance(json_resp["message"], str), "'message' key missing or not string in response"

    # Verify that document is authentic = True (per test case expectation)
    assert json_resp["authentic"] is True, "Document authenticity expected to be True but was False"

    # Verify sha256 hash matches uploaded file
    sha256 = hashlib.sha256()
    sha256.update(pdf_content)
    expected_sha256 = sha256.hexdigest()
    assert json_resp["sha256_hash"].lower() == expected_sha256.lower(), "sha256_hash does not match uploaded file hash"

    # record should be a non-empty dict/object
    assert isinstance(json_resp["record"], dict) and len(json_resp["record"]) > 0, "record should be a non-empty object"


test_post_api_compliance_verify_with_valid_file()