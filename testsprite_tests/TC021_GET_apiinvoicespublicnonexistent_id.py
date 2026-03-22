import requests

def test_get_public_invoice_nonexistent():
    base_url = "http://localhost:3000/api"
    invoice_id = "00000000-0000-0000-0000-000000000099"
    url = f"{base_url}/invoices/public/{invoice_id}"
    try:
        resp = requests.get(url, timeout=30)
        assert resp.status_code == 404, f"Expected status code 404, got {resp.status_code}"
        try:
            data = resp.json()
            # Optionally check for error message, but per spec just expect 404
        except ValueError:
            # If response is not JSON, that's acceptable as long as status is 404
            pass
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_get_public_invoice_nonexistent()