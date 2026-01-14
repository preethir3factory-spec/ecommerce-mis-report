const jwt = require("jsonwebtoken");
const axios = require("axios");
const fs = require("fs");
const { randomUUID } = require("crypto");
const path = require('path');

(async () => {
    console.log("🚀 Starting Noon API Test (V2 Gateway)...");

    // 1️⃣ Load credentials
    let creds = {};
    if (fs.existsSync(path.join(__dirname, 'noon_config.json'))) {
        creds = JSON.parse(fs.readFileSync(path.join(__dirname, 'noon_config.json'), 'utf8'));
    } else if (fs.existsSync(path.join(__dirname, 'noon_credentials_sensitive.json'))) {
        creds = JSON.parse(fs.readFileSync(path.join(__dirname, 'noon_credentials_sensitive.json'), 'utf8'));
    } else {
        console.error("❌ No credential file found.");
        process.exit(1);
    }

    const privateKey = creds.private_key;
    const keyId = creds.key_id;
    const projectCode = creds.project_code || creds.default_project_code;
    const partnerId = String(projectCode).replace(/^(PRJ|p)/i, '');

    if (!privateKey || !keyId) {
        console.error("❌ Missing required Noon credentials (key_id or private_key).");
        process.exit(1);
    }

    console.log(`ℹ️  Using Partner ID: ${partnerId}`);

    // 2️⃣ Generate JWT (Standard Partner Auth)
    const now = Math.floor(Date.now() / 1000);
    const payload = {
        sub: keyId,           // Standard: key_id is subject
        iat: now,
        exp: now + 3600,
        jti: String(Date.now()),
        iss: "noon-partner-api"
    };

    const token = jwt.sign(payload, privateKey, { algorithm: "RS256" });
    // console.log("🔑 JWT Generated:", token);

    const gateway = "https://noon-api-gateway.noon.partners"; // New Value

    const commonHeaders = {
        "Authorization": `Bearer ${token}`,
        "X-Partner-Id": partnerId,
        "X-Request-Id": randomUUID(),
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Locale": "en-AE"
    };

    async function testEndpoint(name, path) {
        console.log(`\nTesting ${name}: ${gateway}${path}`);
        try {
            const res = await axios.get(`${gateway}${path}`, { headers: commonHeaders });
            console.log(`   ✅ ${name} Success (Status: ${res.status})`);
            // console.log(`   Sample Data:`, JSON.stringify(res.data).slice(0, 100));
            return true;
        } catch (err) {
            console.log(`   ❌ ${name} Failed: ${err.message}`);
            if (err.response) {
                console.log(`      Status: ${err.response.status}`);
                console.log(`      Data: ${JSON.stringify(err.response.data)}`);
            }
            return false;
        }
    }

    // 3️⃣ Test 1: WhoAmI (Connectivity Check)
    await testEndpoint("WhoAmI", "/identity/v1/whoami");

    // 4️⃣ Test 2: The endpoint user says implies doesn't exist (but with new domain)
    await testEndpoint("Order V1", "/order/v1/orders?limit=1");

    // 5️⃣ Test 3: FBPI Order List (Common guesses)
    await testEndpoint("FBPI Orders", "/fbpi/v1/orders");
    await testEndpoint("FBPI List", "/fbpi/v1/order/list");

    // 6️⃣ Test 4: General Order List
    await testEndpoint("General Orders", "/v1/orders");

    // 7️⃣ Test 5: Dropship?
    await testEndpoint("Dropship Orders", "/dropship/v1/orders");

    // 8️⃣ Test 6: Integ
    await testEndpoint("Integ Orders", "/_integ/v1/orders");

})();
