const axios = require('axios');
const fs = require('fs');
const https = require('https');

// Load credentials
const creds = JSON.parse(fs.readFileSync('noon_credentials_sensitive.json', 'utf8'));

// Config
// Config
const baseUrls = [
    'https://noon-api-gateway.noon.partners'
];

const paths = [
    '/fbpi/v1/fbpi-order/list', // Guess
    '/fbpi/v1/fbpi-orders',
    '/fbpi/v1/order/list',
    '/fbpi/v1/orders',
    '/fbpi/v1/shipment/list', // Guess
    '/fbpi/v1/shipments',
    '/fbpi/v1/shipment/get', // POST?
];

const token = "TOKEN_PLACEHOLDER"; // We need to generate a token inside the script or mock it. 
// Actually, let's just use the logic from server.js to generate the token.

const jwt = require('jsonwebtoken');

function generateToken() {
    const payload = {
        iss: "noon-partners-key-id-b35b313c3ffe40c6a410ea0bf8a97aa4", // Hardcoded from recent knowledge
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        type: "apijwt",
        channel: "mukul@p47635.idp.noon.partners"
    };
    return jwt.sign(payload, creds.private_key, { algorithm: 'RS256' });
}

async function probe() {
    const token = generateToken();
    const agent = new https.Agent({ rejectUnauthorized: false });

    console.log("🔍 Starting FBPI Probe...");

    for (const base of baseUrls) {
        for (const path of paths) {
            const url = base + path;
            console.log(`Testing: ${url}`);

            try {
                // Try POST (FBPI usually uses POST)
                const res = await axios.post(url, {}, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'X-Partner-Id': 'mukul@p47635.idp.noon.partners',
                        'X-Request-Id': creds.key_id
                    },
                    httpsAgent: agent
                });
                console.log(`✅ SUCCESS! ${url} - Status: ${res.status}`);
                console.log('Result:', JSON.stringify(res.data).substring(0, 200));
            } catch (err) {
                if (err.response) {
                    console.log(`❌ Failed: ${url} - ${err.response.status} ${err.response.statusText}`);
                    if (err.response.status === 400 || err.response.status === 405) {
                        console.log("   -> Endpoint likely EXISTS but needs correct Body/Method.");
                    }
                } else {
                    console.log(`❌ Error: ${err.message}`);
                }
            }
        }
    }
}

probe();
