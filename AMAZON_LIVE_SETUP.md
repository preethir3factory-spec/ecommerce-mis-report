# How to Activate Live Amazon Data

Your extension currently calculates data from CSV files. To fetch **Live Data** directly from Amazon, you need to run the included "Bridge Server".

## Step 1: Install Dependencies
1. Open a terminal in the `server` folder.
   ```bash
   cd server
   npm install
   ```

## Step 2: Configure Keys
1. Open `server/.env`.
2. You **MUST** add your **AWS IAM Access Keys**.
   - **Why?** Amazon SP-API requires requests to be cryptographically signed using AWS credentials to prove identity. LWA Token alone is not enough.
   - **How?** Log in to AWS Console -> IAM -> Users -> Create User (Programmatic Access) -> Copy Key/Secret.

## Step 3: Run the Server
1. Run:
   ```bash
   node server.js
   ```
2. Keep this window open.

## Step 4: Connect Extension
1. Open the Extension -> Settings.
2. Ensure you have your Refresh Token entered.
3. The extension is now listening to `http://localhost:3000`. When you click "Sync", it will talk to this server to fetch fresh data.
