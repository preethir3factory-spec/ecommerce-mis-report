const axios = require('axios');
const jwt = require('jsonwebtoken');
const fs = require('fs');

async function testInventory() {
    console.log("≡ƒÜÇ Starting Noon Inventory Probe...");

    let creds = {};
    if (fs.existsSync('noon_config.json')) {
        creds = JSON.parse(fs.readFileSync('noon_config.json', 'utf8'));
    } else {
        console.error("No config file found.");
        return;
    }

    const { key_id, private_key } = creds;
    if (!key_id || !private_key) {
        console.error("Missing credentials.");
        return;
    }

    // Generate Token
    const token = jwt.sign({
        sub: key_id,
        iat: Math.floor(Date.now() / 1000) - 5,
        jti: String(Date.now())
    }, private_key, { algorithm: "RS256" });

    const gateway = 'https://noon-api-gateway.noon.partners';
    const endpoints = [
        '/cim/v1/items?limit=5',
        '/content/v1/items?limit=5',
        '/v1/items?limit=5',
        '/fbn/v1/items?limit=5'
    ];

    for (const path of endpoints) {
        console.log(`\nTesting Endpoint: ${gateway}${path}`);
        try {
            const res = await axios.get(`${gateway}${path}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Request-Id': key_id,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`   Γ£à Success (${res.status})`);
            if (res.data.items) {
                console.log(`   Found ${res.data.items.length} items.`);
                // console.log("Sample:", JSON.stringify(res.data.items[0], null, 2));
            } else {
                console.log("   Keys:", Object.keys(res.data));
            }
        } catch (err) {
            console.log(`   Γ¥î Failed (${err.response ? err.response.status : err.code}): ${err.message}`);
        }
    }
}

testInventory();
