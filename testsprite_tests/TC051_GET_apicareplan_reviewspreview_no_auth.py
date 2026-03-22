import requests

BASE_URL = "http://localhost:3000/api"

def test_get_care_plan_reviews_preview_no_auth():
    url = f"{BASE_URL}/care/plan-reviews/preview"
    params = {'report_id': 'test'}
    try:
        response = requests.get(url, params=params, timeout=30)
        assert response.status_code == 401, f"Expected 401 Unauthorized, got {response.status_code}"
    except requests.RequestException as e:
        assert False, f"Request failed: {e}"

test_get_care_plan_reviews_preview_no_auth()