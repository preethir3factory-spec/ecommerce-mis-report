const fs = require('fs');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

(async () => {
    console.log("🚀 Starting Noon Gateway Scanner...");

    const path = require('path');
    const configPath = path.join(__dirname, 'noon_config.json');
    // Load Creds
    if (!fs.existsSync(configPath)) { console.error("Missing config at " + configPath); process.exit(1); }
    const creds = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    // Gen JWT
    const token = jwt.sign({
        sub: creds.key_id,
        iat: Math.floor(Date.now() / 1000),
        jti: String(Date.now())
    }, creds.private_key, { algorithm: "RS256" });

    let projectCode = creds.project_code.replace(/^(PRJ|p)/i, '');
    console.log(`ℹ️ Project Code: ${projectCode}`);

    const client = wrapper(axios.create({ jar: new CookieJar() }));

    // Login for Good Measure
    try {
        await client.post("https://noon-api-gateway.noon.partners/identity/public/v1/api/login", {
            token, default_project_code: projectCode
        });
        console.log("✅ Login OK");

        const whoami = await client.get("https://noon-api-gateway.noon.partners/identity/v1/whoami", {
            headers: {
                "Authorization": `Bearer ${token}`,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
            }
        });
        console.log("👤 WhoAmI:", JSON.stringify(whoami.data));

    } catch (e) {
        console.error("❌ Login/WhoAmI Failed", e.message);
    }

    const gateway = "https://noon-api-gateway.noon.partners";
    const commonHeaders = {
        "Authorization": `Bearer ${token}`,
        "X-Partner-Id": projectCode,
        "X-Request-Id": creds.key_id,
        "Accept": "application/json",
        "Content-Type": "application/json",
        "X-Locale": "en-AE",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
    };

    const targets = [
        // FBN (Fulfilled By Noon)
        { path: '/fbn/v1/shipment/list', method: 'POST' },
        { path: '/fbn/v1/orders', method: 'GET' },
        { path: '/fbn/v1/order/list', method: 'POST' },

        // Reports/Analytics
        { path: '/analytics/v1/report/list', method: 'POST' },
        { path: '/reports/v1/list', method: 'POST' },

        // Core / Dropship
        { path: '/directship/v1/order/list', method: 'POST' },
        { path: '/ds/v1/order/list', method: 'POST' },

        // Maybe it's 'content' API for items, but 'order' for sales?

        // Try the base paths again
        { path: '/v1/order/list', method: 'POST' },
        { path: '/order/v1/list', method: 'POST' },

        // Wildcard
        { path: '/config/v1/projects', method: 'GET' },
        // Known Namespace: /fbpi/v1/

        { path: '/fbpi/v1/shipment/list', method: 'GET' },
        { path: '/fbpi/v1/shipment/list', method: 'POST' }, // Retrying with clean slate

        { path: '/fbpi/v1/order/list', method: 'GET' },
        { path: '/fbpi/v1/order/list', method: 'POST' },

        { path: '/fbpi/v1/shipments', method: 'GET' },
        { path: '/fbpi/v1/orders', method: 'GET' },

        { path: '/fbpi/v1/shipment/search', method: 'POST' },

        // Maybe 'outbound'?
        // { path: '/fbpi/v1/outbound/shipment/list', method: 'POST' },

        // Maybe different version?
        { path: '/fbpi/v2/shipment/list', method: 'POST' },
        { path: '/fbpi/v2/order/list', method: 'POST' },

        // Root?
        { path: '/v1/shipment/list', method: 'POST' },
        { path: '/v1/order/list', method: 'POST' },

        // Specific guessing
        { path: '/fbpi/v1/orders/download', method: 'POST' }
    ];

    for (const t of targets) {
        process.stdout.write(`Testing ${t.method} ${t.path} ... `);
        try {
            const res = await client.request({
                method: t.method,
                url: gateway + t.path,
                headers: commonHeaders,
                data: t.method === 'POST' ? (t.data || { limit: 10, offset: 0, status: ["created"] }) : undefined,
                params: t.method === 'GET' ? { limit: 10 } : undefined
            });
            console.log(`✅ ${res.status}`);
            if (res.status === 200) {
                console.log("   DATA:", JSON.stringify(res.data).slice(0, 100));
            }
        } catch (e) {
            const s = e.response ? e.response.status : e.message;
            console.log(`❌ ${s}  [Input: ${JSON.stringify(t.data)}]`);
            if (e.response && e.response.data && e.response.status !== 404) {
                console.log("   ERR:", JSON.stringify(e.response.data));
            }
        }
    }

})();
