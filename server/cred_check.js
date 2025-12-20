const fs = require("fs");
const jwt = require("jsonwebtoken");
const axios = require("axios");

(async () => {
    // Load credentials
    const credsPath = "noon_credentials_sensitive.json";
    if (!fs.existsSync(credsPath)) {
        console.log("❌ sensitive file missing!"); process.exit(1);
    }
    const creds = JSON.parse(fs.readFileSync(credsPath, "utf8"));
    console.log(`Loaded Key ID: ${creds.key_id}`);

    if (!creds.key_id.startsWith("noon-partners-key-id-b35b")) {
        console.log("❌ Mismatch! Still using old key.");
    } else {
        console.log("✅ Key ID matches new b35b key.");
    }

    // Attempt Bearer Auth Check (WhoAmI equivalent)?
    // Noon Direct API doesn't have a simple GET /whoami with Bearer usually, 
    // but likely /identity/v1/whoami supports it? OR just /order/v1/orders with limit=1 to test 401 vs 418.

    // ... code to test ...
})();
