# How to Activate Live Amazon Data (Render Deployment)

To fetch **Live Data** directly from Amazon, your backend must be correctly configured on Render.com and your Extension must have the correct SP-API credentials.

## Step 1: Configure Render Environment Variables
Amazon SP-API requires requests to be cryptographically signed using AWS credentials.
1. Log in to your **Render.com** dashboard.
2. Go to your `ecommerce-mis-report` service -> **Settings** -> **Environment Variables**.
3. Add the following keys:
   - `AWS_ACCESS_KEY`: Your IAM User Access Key (starts with `AKIA...`)
   - `AWS_SECRET_KEY`: Your IAM User Secret Key.
   - `AWS_REGION`: `eu-west-1` (for UAE/Saudi/Egypt).

## Step 2: Configure Extension Settings
1. Open the **E-commerce MIS Report** extension.
2. Click the **Settings (Gear Icon)** ⚙️ at the top right.
3. Enter your Amazon SP-API credentials:
   - **Refresh Token**: Your long-lived Atzr|... token.
   - **Client ID**: From your Amazon Developer Central App registration.
   - **Client Secret**: From your Amazon Developer Central App registration.
   - **Marketplace**: Select your region (e.g., UAE).
4. Click **Save Configuration**.

## Step 3: Troubleshooting 401 Errors
If you see a `401 Unauthorized` error:
- It means Amazon rejected your **Refresh Token**, **Client ID**, or **Client Secret**.
- Double-check these 3 values in the extension settings.
- Ensure your SP-API App is in "Draft" or "Published" state and authorized.

## Step 4: Sync Data
1. Click **Sync Live Data from Server 🚀**.
2. If successful, you will see "✅ Amazon Synced".
3. Use **Reset Data & Resync** if you need to fetch historical data (up to 1 year).
