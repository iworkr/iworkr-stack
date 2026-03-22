import requests

base_endpoint = "http://localhost:3000/api"

def test_get_nonexistent_public_invoice_returns_404():
    invoice_id = "00000000-0000-0000-0000-000000000099"
    url = f"{base_endpoint}/invoices/public/{invoice_id}"

    try:
        response = requests.get(url, timeout=30)
        assert response.status_code == 404, f"Expected status code 404 but got {response.status_code}. Response text: {response.text}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_get_nonexistent_public_invoice_returns_404()