import requests

def test_post_invoices_generate_pdf_no_auth():
    base_url = 'http://localhost:3000/api/invoices/generate-pdf'
    payload = {
        "invoice_id": "00000000-0000-0000-0000-000000000001"
    }
    try:
        response = requests.post(base_url, json=payload, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed with exception: {e}"

    assert response.status_code == 401, f"Expected status code 401 but got {response.status_code}"
    # Optionally check response content or message if JSON returned
    # Try to parse JSON if possible, else skip
    try:
        json_resp = response.json()
        assert "Not authenticated" in str(json_resp).lower() or "error" in json_resp, "Expected error message about not authenticated"
    except ValueError:
        # Response is not JSON, just ensure status code is 401
        pass

test_post_invoices_generate_pdf_no_auth()