const fs = require("fs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const { wrapper } = require("axios-cookiejar-support");
const { CookieJar } = require("tough-cookie");

(async () => {
    // Load credentials (prefer config file first)
    let credsFile;
    if (fs.existsSync("noon_config.json")) {
        credsFile = "noon_config.json";
    } else if (fs.existsSync("noon_credentials_sensitive.json")) {
        credsFile = "noon_credentials_sensitive.json";
    } else {
        credsFile = "noon_credentials.json";
    }

    if (!fs.existsSync(credsFile)) {
        console.error(`❌ Error: No credential file found (checked noon_config.json, noon_credentials_sensitive.json, noon_credentials.json).`);
        process.exit(1);
    }

    const creds = JSON.parse(fs.readFileSync(credsFile, "utf8"));

    const privateKey = creds.private_key;
    const keyId = creds.key_id;
    let projectCode = creds.project_code || creds.default_project_code; // Handle variations

    // Sanitize Project Code (Remove 'PRJ' or 'p' prefix)
    if (projectCode && typeof projectCode === 'string') {
        projectCode = projectCode.replace(/^(PRJ|p)/i, '');
    }

    if (!privateKey || !keyId) {
        console.error("❌ Error: Missing private_key or key_id in credentials file.");
        process.exit(1);
    }

    console.log("🔐 Authenticating with Noon...");

    // Create JWT
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        sub: keyId,
        iat: now,
        jti: String(Date.now()),
    };

    const token = jwt.sign(payload, privateKey, { algorithm: "RS256" });

    // Create Axios instance with cookie jar
    const jar = new CookieJar();
    const client = wrapper(axios.create({ jar }));

    try {
        // Login request
        const loginResponse = await client.post(
            "https://noon-api-gateway.noon.partners/identity/public/v1/api/login",
            {
                token: token,
                default_project_code: projectCode,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                },
            }
        );

        console.log("✅ Login successful.");
        // console.log(loginResponse.data);

        // the response from above will contain the auth cookie,
        // which can be used for subsequent authenticated requests
        // if using an HTTP client which maintains cookies
        const whoamiResponse = await client.get("https://noon-api-gateway.noon.partners/identity/v1/whoami", {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        console.log("👤 WhoAmI Data:", JSON.stringify(whoamiResponse.data, null, 2));

    } catch (error) {
        console.error("❌ API Error:", error.response ? error.response.data : error.message);
    }
})();
