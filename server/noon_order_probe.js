const jwt = require("jsonwebtoken");
const axios = require("axios");
const fs = require("fs");
const { randomUUID } = require("crypto");

(async () => {
    // 1️⃣ Load credentials
    const creds = JSON.parse(
        fs.readFileSync("noon_credentials_sensitive.json", "utf8")
    );

    const privateKey = creds.private_key;
    const keyId = creds.key_id;
    const channelIdentifier = creds.channel_identifier;
    const partnerId = String(creds.project_code).replace(/^(PRJ|p)/i, '');

    if (!privateKey || !keyId || !channelIdentifier || !partnerId) {
        throw new Error("Missing required Noon credentials");
    }

    // 2️⃣ Generate Partner JWT
    const now = Math.floor(Date.now() / 1000);

    const payload = {
        iss: keyId,                     // key_id
        sub: channelIdentifier,         // channel_identifier
        aud: "noon-api",                // REQUIRED
        iat: now,
        exp: now + (15 * 60),            // 15 minutes
        jti: randomUUID()
    };

    const token = jwt.sign(payload, privateKey, {
        algorithm: "RS256",
        keyid: keyId                   // kid header
    });

    const commonHeaders = {
        Authorization: `Bearer ${token}`,
        "X-Partner-Id": partnerId,
        Accept: "application/json"
    };

    try {
        // 3️⃣ Call Partner WhoAmI
        console.log("🔍 Calling Partner WhoAmI...,", token);
        console.log("🔍 pid", randomUUID());


        const whoamiResp = await axios.get(
            "https://noon-api-gateway.noon.partners/identity/v1/whoami",
            {
                headers: {
                    ...commonHeaders,
                    "X-Request-Id": randomUUID(),
                    "Content-Type": "application/json"
                }

            }
        );

        console.log('error', whoamiResp)

        console.log("✅ WhoAmI success:");
        console.log(JSON.stringify(whoamiResp.data, null, 2));

        // 4️⃣ Call Orders API using SAME token
        console.log("📦 Fetching Orders...");

        const ordersResp = await axios.get(
            "https://noon-api-gateway.noon.partners/fbpi/v1/orders?updatedSince=2024-01-01T00:00:00Z",
            {
                headers: {
                    ...commonHeaders,
                    "X-Request-Id": randomUUID()
                }
            }
        );

        console.log("✅ Orders fetched successfully");
        console.log(JSON.stringify(ordersResp.data, null, 2));

    } catch (err) {
        console.error("❌ API FAILED");
        console.error("Status:", err.response?.status);
        console.error("Body:", JSON.stringify(err.response?.data, null, 2));
    }
})();
