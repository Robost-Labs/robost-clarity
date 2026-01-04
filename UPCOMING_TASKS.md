# Upcoming Tasks & Verification Workflows

The following tasks are planned for the next phase of development and verification.

## 1. Custom Domain & DNS
- [ ] Complete DNS verification for `clarity.robostai.com` in Google Cloud Console.
- [ ] Monitor SSL certificate provisioning for the custom domain.
- [ ] (Optional) Map `api.robostai.com` to the API service if desired.

## 2. CI/CD Automation
- [ ] Connect the GitHub repository to Cloud Build.
- [ ] Execute `gcp/setup_cicd.sh` (forthcoming) to create builds triggers.
- [ ] Verify that a push to `main` triggers a full build/deploy cycle.

## 3. Product Verification Workflows
- [x] **Employee Invitation Flow** (Verified 2024-12-29):
    - [x] Invite a user from the Organization Settings (`POST /users/invite`).
    - [x] Verify temp password is generated and returned.
    - [x] Complete their registration and verify login.
    - [x] Web console login correctly blocked for Employee role (403).
    - [x] Extension login works for Employee role.
- [x] **Extension End-to-End** (Verified 2024-12-29):
    - [x] Build extension zip (`robost-clarity-extension.zip` - 12KB).
    - [x] Extension configured for production API (`https://robost-api-ehnzr3alha-ww.a.run.app`).
    - [x] Authentication endpoint (`POST /auth/extension/login`) verified working.
    - [x] Sideloaded in Chrome - content script initializes on LLM sites (confirmed via console).
    - [x] LLM requests from extension appear in admin dashboard (tested: openai, anthropic, google).
- [x] **Multi-Tenancy Isolation** (Verified 2024-12-29):
    - [x] Created two separate organizations via signup.
    - [x] Confirmed user lists are isolated (0 intersection).
    - [x] Data (requests, rules, users) strictly scoped to organization.

## Relevant Links
- **Fixing Database Schema**: [Conversation Logs](file:///Users/mohamedelkhawaga/.gemini/antigravity/brain/735a5e85-ce95-42cf-af84-6a817a043093/.system_generated/logs/verifying_live_signup_flow.txt)
- **Repo Explanation**: [Original Conversation](file:///Users/mohamedelkhawaga/.gemini/antigravity/brain/735a5e85-ce95-42cf-af84-6a817a043093/.system_generated/logs/explaining_repo_contents.txt) -- *Note: Paths may vary based on your local log structure.*
- **General Rules**: [GEMINI.md](file:///Users/mohamedelkhawaga/.gemini/GEMINI.md)
