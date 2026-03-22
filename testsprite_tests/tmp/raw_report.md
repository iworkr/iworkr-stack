
# TestSprite AI Testing Report(MCP)

---

## 1️⃣ Document Metadata
- **Project Name:** iWorkr-Linear
- **Date:** 2026-03-22
- **Prepared by:** TestSprite AI Team

---

## 2️⃣ Requirement Validation Summary

#### Test TC001 post api auth switch context with valid session
- **Test Code:** [TC001_post_api_auth_switch_context_with_valid_session.py](./TC001_post_api_auth_switch_context_with_valid_session.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 48, in <module>
  File "<string>", line 36, in test_post_api_auth_switch_context_with_valid_session
AssertionError: Expected status code 200, got 401

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/725b8146-2237-4826-8d7b-9f46f5041f10/63ea3ee4-1393-47ef-a397-8111c4e013f4
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC002 get api auth switch context with valid session
- **Test Code:** [TC002_get_api_auth_switch_context_with_valid_session.py](./TC002_get_api_auth_switch_context_with_valid_session.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 23, in <module>
  File "<string>", line 18, in test_get_api_auth_switch_context_with_valid_session
AssertionError: Invalid workspaceId value

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/725b8146-2237-4826-8d7b-9f46f5041f10/420f8e41-2583-4cc1-8563-796a42458562
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC003 post api auth switch context without session cookie
- **Test Code:** [TC003_post_api_auth_switch_context_without_session_cookie.py](./TC003_post_api_auth_switch_context_without_session_cookie.py)
- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/725b8146-2237-4826-8d7b-9f46f5041f10/d4d881aa-1c2b-47d1-9311-4612b0d6a954
- **Status:** ✅ Passed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC004 get api auth switch context with expired or invalid cookie
- **Test Code:** [TC004_get_api_auth_switch_context_with_expired_or_invalid_cookie.py](./TC004_get_api_auth_switch_context_with_expired_or_invalid_cookie.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 20, in <module>
  File "<string>", line 18, in test_get_api_auth_switch_context_with_expired_or_invalid_cookie
AssertionError: Expected status 401, got 200

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/725b8146-2237-4826-8d7b-9f46f5041f10/a9a96ca4-80e5-4267-98e1-8f85bc402841
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC005 post api team invite with valid admin session
- **Test Code:** [TC005_post_api_team_invite_with_valid_admin_session.py](./TC005_post_api_team_invite_with_valid_admin_session.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 43, in <module>
  File "<string>", line 32, in test_post_api_team_invite_with_valid_admin_session
AssertionError: Expected 200 OK but got 401

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/725b8146-2237-4826-8d7b-9f46f5041f10/d0092576-918c-40de-8b7f-1ccd166cbae1
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC006 post api team validate invite with valid token
- **Test Code:** [TC006_post_api_team_validate_invite_with_valid_token.py](./TC006_post_api_team_validate_invite_with_valid_token.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 38, in <module>
  File "<string>", line 36, in test_post_api_team_validate_invite_with_valid_token
  File "<string>", line 27, in test_post_api_team_validate_invite_with_valid_token
AssertionError: Email field missing or wrong type

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/725b8146-2237-4826-8d7b-9f46f5041f10/3460ded9-8aef-4f76-b778-b273d4308f8f
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC007 post api team signup invite with valid data
- **Test Code:** [TC007_post_api_team_signup_invite_with_valid_data.py](./TC007_post_api_team_signup_invite_with_valid_data.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 53, in <module>
  File "<string>", line 46, in test_post_api_team_signup_invite_with_valid_data
AssertionError: Expected status 200 but got 400

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/725b8146-2237-4826-8d7b-9f46f5041f10/d81fb575-75fd-4647-8897-a072928b660f
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC008 post api team accept invite with valid session
- **Test Code:** [TC008_post_api_team_accept_invite_with_valid_session.py](./TC008_post_api_team_accept_invite_with_valid_session.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 28, in <module>
  File "<string>", line 16, in test_post_api_team_accept_invite_with_valid_session
AssertionError: Expected status code 200, got 500

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/725b8146-2237-4826-8d7b-9f46f5041f10/1dad872c-ccce-4ad6-8ba9-b4cf42d0bbde
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC009 post api team set password with admin privileges
- **Test Code:** [TC009_post_api_team_set_password_with_admin_privileges.py](./TC009_post_api_team_set_password_with_admin_privileges.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 88, in <module>
  File "<string>", line 32, in test_post_api_team_set_password_with_admin_privileges
AssertionError: Invite failed with status 401

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/725b8146-2237-4826-8d7b-9f46f5041f10/b013cb3f-58cf-4ab1-aa3f-a3c099e3f0c6
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---

#### Test TC010 post api compliance verify with file upload
- **Test Code:** [TC010_post_api_compliance_verify_with_file_upload.py](./TC010_post_api_compliance_verify_with_file_upload.py)
- **Test Error:** Traceback (most recent call last):
  File "/var/task/handler.py", line 258, in run_with_retry
    exec(code, exec_env)
  File "<string>", line 19, in <module>
  File "<string>", line 10, in test_post_api_compliance_verify_with_file_upload
AssertionError: Expected status 200, got 500

- **Test Visualization and Result:** https://www.testsprite.com/dashboard/mcp/tests/725b8146-2237-4826-8d7b-9f46f5041f10/6d15d77e-8e8c-48a0-9086-f3338a00cc9c
- **Status:** ❌ Failed
- **Analysis / Findings:** {{TODO:AI_ANALYSIS}}.
---


## 3️⃣ Coverage & Matching Metrics

- **10.00** of tests passed

| Requirement        | Total Tests | ✅ Passed | ❌ Failed  |
|--------------------|-------------|-----------|------------|
| ...                | ...         | ...       | ...        |
---


## 4️⃣ Key Gaps / Risks
{AI_GNERATED_KET_GAPS_AND_RISKS}
---