# Deployment Guide: E-commerce MIS Report Extension

To make this extension "Live" and accessible to users without running a local server, you need to follow these two main phases:

## Phase 1: Deploy the Backend (Server)
Currently, the extension relies on `server.js` running on your laptop. For a live extension, this code must run in the cloud.

### Recommended Host: Render.com (Simple & Free/Cheap)
1. **Push your code to GitHub** (Create a private repository).
2. **Sign up for Render.com** and link your GitHub.
3. **Create a "Web Service"**:
   - Point it to your repo's `/server` directory.
   - Command: `node server.js`
   - Environment Variables (Add these in Render Dashboard):
     - `PORT`: `3000` (or leave default)
     - `AWS_ACCESS_KEY`: (Your Amazon Key)
     - `AWS_SECRET_KEY`: (Your Amazon Secret)
   - **Important**: For Noon Credentials, you cannot upload `noon_credentials_sensitive.json` to public GitHub. You should either:
     - Use a Private Repo.
     - OR Setup Render "Secret Files" to upload the JSON.
     - OR Convert the JSON content into Environment Variables (e.g., `NOON_PRIVATE_KEY` and `NOON_KEY_ID`).

### Once Deployed:
Render will give you a URL like: `https://ecommerce-mis-backend.onrender.com`.

---

## Phase 2: Update the Extension
1. Open `popup.js`.
2. Find all occurrences of `http://localhost:3000`.
3. Replace them with your new Backend URL (e.g., `https://ecommerce-mis-backend.onrender.com`).
4. **Test the extension locally** with the live server to ensure it works.

---

## Phase 3: Publish to Chrome Web Store by Google
1. **Prepare the Package**:
   - Create a ZIP file selected **ONLY** these files:
     - `manifest.json`
     - `popup.html`
     - `popup.js`
     - `style.css`
     - `explore.html`
     - `explore.js`
     - `icons/` (if any)
   - **CRITICAL**: Do NOT include the `server/` folder or any `.env` files in the ZIP. These contain your secrets!

2. **Register**: Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard).
   - You need to pay a one-time $5 fee.

3. **Upload**:
   - Click "New Item".
   - Upload your ZIP file.

4. **Listing**:
   - Fill in Title, Description, Screenshots.
   - Select Category (Productivity / Business).

5. **Submit for Review**: Google will review it (usually takes 24-48 hours).

## Quick Local Sharing (Alternative)
If you just want to share it with your team without the Web Store:
1. Follow Phase 1 & 2.
2. Zip the extension files (exclude server).
3. Send the ZIP to your team.
4. They unzip it.
5. Open Chrome -> `chrome://extensions` -> Turn on **Developer Mode** -> Click **Load Unpacked** -> Select the folder.
