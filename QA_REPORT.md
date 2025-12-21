# QA Report and Debugging Guide

## Issue: Amazon Data Not Showing
User reported that Amazon data was not appearing in the extension or dashboard.

### Diagnosis
The backend server (`server.js`) had a logic flaw where missing or placeholder AWS credentials (`AWS_ACCESS_KEY`, `AWS_SECRET_KEY`) would result in a "Success" response with empty data (0 sales), instead of an error. This made it difficult to identify misconfiguration.

### Fix Applied
1.  **Modified `server/server.js`**:
    *   Added strict validation for server-side environment variables (`AWS_ACCESS_KEY`, `AWS_SECRET_KEY`).
    *   Added checks to detect default placeholder values (e.g., `your_aws_access_key`, `AKIA...`).
    *   Now returns a `500 Server Config Error` if keys are missing or invalid, allowing the extension to display a clear error message.

2.  **Updated QA Test Runner**:
    *   Modified `server/qa_test_runner.js` to include a local `.env` file check.
    *   Added a specific test to probe the server's AWS configuration by sending a request that bypasses basic checks and targets the AWS credential validation logic.

### How to Run QA Tests
To verify your installation and configuration:

1.  Open a terminal in the project root.
2.  Ensure your local server is running in another terminal (`cd server && node server.js`).
3.  Run the QA script:
    ```bash
    node server/qa_test_runner.js
    ```

### Expected Results
*   **Test 0**: should PASS (if local `.env` is correct) or SKIP (if relying on Render vars).
*   **Test 1 & 3**: should PASS (verifying server is up and Excel generation works).
*   **Test 4 (Amazon Config)**: should PASS.
    *   If it fails with "Server Misconfigured", check your `.env` file or Render Environment Variables for valid `AWS_ACCESS_KEY` and `AWS_SECRET_KEY`.

### Next Steps for Deployment
*   **On Render.com**: Go to your Service -> Environment. Ensure `AWS_ACCESS_KEY` and `AWS_SECRET_KEY` are set to your *actual* IAM User credentials, not the placeholders.
*   **In Extension**: Go to Settings -> Test API. You should now see either "✅ Amazon Synced" or a specific "❌ Amazon Error" telling you what is wrong.
