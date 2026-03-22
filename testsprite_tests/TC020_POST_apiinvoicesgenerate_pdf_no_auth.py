import requests

def test_post_api_invoices_generate_pdf_no_auth():
    base_url = "http://localhost:3000/api"
    url = f"{base_url}/invoices/generate-pdf"
    json_body = {"invoice_id": "00000000-0000-0000-0000-000000000001"}
    try:
        response = requests.post(url, json=json_body, timeout=30)
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"
    assert response.status_code == 401, f"Expected 401 Unauthorized but got {response.status_code}"

test_post_api_invoices_generate_pdf_no_auth()