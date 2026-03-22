import requests

def test_get_care_plan_reviews_preview_no_auth():
    base_url = "http://localhost:3000/api"
    params = {"report_id": "test"}
    url = f"{base_url}/care/plan-reviews/preview"

    try:
        response = requests.get(url, params=params, timeout=30)
        assert response.status_code == 401, f"Expected status code 401 but got {response.status_code}"
        try:
            json_resp = response.json()
            # Usually 401 responses include a message attribute, but no specific schema given
            assert "Not authenticated" in str(json_resp).lower() or "unauthorized" in str(json_resp).lower(), \
                "Expected 'Not authenticated' or 'unauthorized' message in response."
        except Exception:
            # If body is not json, okay as long as status is 401
            pass
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_get_care_plan_reviews_preview_no_auth()