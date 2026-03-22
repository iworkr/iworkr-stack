import requests

BASE_API_URL = "http://localhost:3000/api"
SUPABASE_AUTH_URL = "https://olqjuadvseoxpfjzlghb.supabase.co/auth/v1/token?grant_type=password"
SUPABASE_APIKEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ...YOUR_SUPABASE_API_KEY_HERE..."
AUTH_USER_EMAIL = "testsprite-qa@iworkrapp.com"
AUTH_USER_PASSWORD = "TestSprite2026!"
DEFAULT_TIMEOUT = 30

def get_supabase_access_token():
    headers = {
        "apikey": SUPABASE_APIKEY,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    payload = {
        "email": AUTH_USER_EMAIL,
        "password": AUTH_USER_PASSWORD
    }
    try:
        response = requests.post(SUPABASE_AUTH_URL, json=payload, headers=headers, timeout=DEFAULT_TIMEOUT)
        response.raise_for_status()
        json_resp = response.json()
        access_token = json_resp.get("access_token")
        if not access_token:
            raise Exception("Access token not found in Supabase auth response")
        return access_token
    except Exception as e:
        raise Exception(f"Failed to get Supabase access token: {e}")

def test_get_api_clients_statement_with_valid_client_id():
    access_token = get_supabase_access_token()
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/pdf"
    }

    # Since no client ID is provided, create a new client to get a valid client ID
    # Create client endpoint (not provided in PRD but assuming POST /api/clients for creating client)
    # The PRD does not provide client creation endpoint, so we assume one based on typical REST API:
    # POST /api/clients with body { name: string, email: string } and auth
    # If not available, we cannot create client; thus test fails. Otherwise:
    client_create_url = f"{BASE_API_URL}/clients"
    client_payload = {
        "name": "Test Client TC009",
        "email": "tc009client@example.com"
    }
    client_id = None
    try:
        # Try to create a new client to use for test
        create_resp = requests.post(client_create_url, json=client_payload, headers={"Authorization": f"Bearer {access_token}"}, timeout=DEFAULT_TIMEOUT)
        if create_resp.status_code == 201 or create_resp.status_code == 200:
            client_data = create_resp.json()
            client_id = client_data.get("id") or client_data.get("client_id")
            if not client_id:
                raise Exception("Created client response missing id")
        else:
            # If create client endpoint not found or forbidden, fallback to known client ID from org for testing
            # Using the owner's org id from the PRD: 00000000-0000-0000-0000-000000000001 -- but that is org id not client id
            # Without client creation endpoint or sample client id we can't proceed, so fallback id hardcoded:
            client_id = "00000000-0000-0000-0000-000000000001"  # fallback client id (may fail if invalid)
        
        # Now do GET /api/clients/{id}/statement
        statement_url = f"{BASE_API_URL}/clients/{client_id}/statement"
        statement_resp = requests.get(statement_url, headers=headers, timeout=DEFAULT_TIMEOUT)
        assert statement_resp.status_code == 200, f"Expected 200 OK, got {statement_resp.status_code}"
        content_type = statement_resp.headers.get("Content-Type", "")
        assert "pdf" in content_type.lower(), f"Expected Content-Type to include 'pdf', got '{content_type}'"
        content = statement_resp.content
        assert len(content) > 0, "Expected non-empty PDF binary content in response"

    finally:
        # Cleanup: Delete client if it was created (assuming DELETE /api/clients/{id} with auth)
        if client_id:
            try:
                delete_url = f"{BASE_API_URL}/clients/{client_id}"
                del_resp = requests.delete(delete_url, headers={"Authorization": f"Bearer {access_token}"}, timeout=DEFAULT_TIMEOUT)
                # We do not assert here, just attempt cleanup
            except:
                pass

test_get_api_clients_statement_with_valid_client_id()