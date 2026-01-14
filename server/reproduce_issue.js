/**
 * REPRODUCTION SCRIPT FOR NOON API SUPPORT
 * Usage: node reproduce_issue.js
 * 
 * Description:
 * This script attempts to fetch orders from the Noon API using the standard authentication flow
 * described in the Noon API documentation.
 * 
 * Expected Result: JSON response with orders.
 * Actual Result: 418 Fault Filter Abort.
 */

const fs = require('fs');
const jwt = require('jsonwebtoken'); // npm install jsonwebtoken
const axios = require('axios'); // npm install axios
const path = require('path');

// --- CONFIGURATION ---
// Please ensure 'noon_config.json' exists with valid key_id, private_key, and project_code
const configPath = path.join(__dirname, 'noon_config.json');
if (!fs.existsSync(configPath)) {
    console.error("Error: noon_config.json file missing.");
    process.exit(1);
}

const creds = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const private_key = creds.private_key;
const key_id = creds.key_id;
const project_code = creds.project_code || creds.default_project_code;

// Ensureclean partner ID (e.g. remove 'p' prefix if present)
const partnerId = project_code ? project_code.replace(/^(PRJ|p)/i, '') : '';

console.log('=== NOON API REPRODUCTION SCRIPT ===');
console.log(`Node Version: ${process.version}`);
console.log(`Key ID: ${key_id}`);
console.log(`Partner ID: ${partnerId}`);
console.log('------------------------------------');

// 1. Generate JWT
const now = Math.floor(Date.now() / 1000) - 5;
const payload = {
    sub: key_id,
    iat: now,
    jti: String(Date.now()),
};

try {
    const token = jwt.sign(payload, private_key, { algorithm: "RS256" });
    console.log("✅ JWT Generated successfully.");

    // 2. Execute API Request
    // 2. Execute API Request
    // URL updated to correct gateway
    const url = 'https://noon-api-gateway.noon.partners/fbpi/v1/orders';

    console.log(`\n📡 Sending GET request to: ${url}`);

    (async () => {
        try {
            const response = await axios.get(url, {
                params: {
                    limit: 1,
                    status: 'created' // FBPI might use different status or NO query params for webhooks only?
                },
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "X-Partner-Id": partnerId,
                    "X-Request-Id": key_id,
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "X-Locale": "en-AE"
                }
            });

            console.log(`\n✅ SUCCESS: Status ${response.status}`);
            console.log("Response Data Preview:", response.data);

        } catch (error) {
            console.log(`\n❌ FAILED: API Request Blocked or Error.`);
            if (error.response) {
                console.log(`   Status Code: ${error.response.status}`); // Expecting 418
                console.log(`   Status Text: ${error.response.statusText}`);
                console.log(`   Response Body: ${JSON.stringify(error.response.data)}`);
                console.log(`   Headers: ${JSON.stringify(error.response.headers, null, 2)}`);
            } else {
                console.log(`   Error Message: ${error.message}`);
            }
        }
    })();

} catch (e) {
    console.error("Script Error:", e.message);
}
