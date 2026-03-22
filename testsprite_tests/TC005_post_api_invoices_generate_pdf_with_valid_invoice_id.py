import requests
import json

BASE_ENDPOINT = "http://localhost:3000/api"
SUPABASE_AUTH_URL = "https://olqjuadvseoxpfjzlghb.supabase.co/auth/v1/token?grant_type=password"
SUPABASE_API_KEY = "anon-key"  # Placeholder, as apikey header is required. Use actual key if available.
SUPABASE_EMAIL = "testsprite-qa@iworkrapp.com"
SUPABASE_PASSWORD = "TestSprite2026!"

def get_access_token():
    headers = {
        "apikey": SUPABASE_API_KEY,
        "Content-Type": "application/json"
    }
    data = {
        "email": SUPABASE_EMAIL,
        "password": SUPABASE_PASSWORD
    }
    resp = requests.post(SUPABASE_AUTH_URL, headers=headers, data=json.dumps(data), timeout=30)
    resp.raise_for_status()
    token_json = resp.json()
    assert "access_token" in token_json
    return token_json["access_token"]

def create_invoice(auth_token):
    # Create a minimal invoice to get a valid invoice_id for testing.
    # Using /api/invoices endpoint if exists to create invoice; if not, skip creation.
    # Since PRD does not provide an invoice creation endpoint, skip creation and raise.
    raise RuntimeError("No invoice creation endpoint available to generate test invoice_id.")

def test_post_api_invoices_generate_pdf_with_valid_invoice_id():
    access_token = get_access_token()
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json",
        "Accept": "application/pdf"
    }

    # Since no invoice creation endpoint detailed in PRD, try to get an existing invoice id.
    # Attempt to get invoice list or public invoice data to obtain an invoice_id for testing.

    # Attempt to get list of invoices or a public invoice for an example invoice_id
    # PRD has GET /api/invoices/public/{invoiceId} (public, no auth)
    # Without a list endpoint, no way to get invoice ids programmatically.
    # Thus, skip dynamic creation, use a placeholder invoice_id.

    invoice_id = None

    # Strategy: Try common placeholder invoice_id, or fail test if none available.
    # Use a known test invoice_id string for demonstration.
    invoice_id = "00000000-0000-0000-0000-000000000000"  # Placeholder: update with real invoice_id for real test

    if not invoice_id:
        raise RuntimeError("Test invoice ID not provided and invoice creation unavailable.")

    url = f"{BASE_ENDPOINT}/invoices/generate-pdf"
    payload = {"invoice_id": invoice_id}

    response = requests.post(url, headers=headers, json=payload, timeout=30)
    try:
        response.raise_for_status()
    except requests.HTTPError as e:
        # If 404 or 400, fail test explicitly
        assert False, f"Request failed with status {response.status_code}: {response.text}"

    # Validate response is PDF binary content by checking Content-Type header
    content_type = response.headers.get("Content-Type", "")
    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}"
    assert "application/pdf" in content_type.lower(), f"Expected PDF content-type, got {content_type}"
    assert len(response.content) > 0, "PDF response body is empty"

test_post_api_invoices_generate_pdf_with_valid_invoice_id()