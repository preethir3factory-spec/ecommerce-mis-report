require('dotenv').config();
const express = require('express');
const XLSX = require('xlsx');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

const app = express();
app.use(cors());
app.use(express.json());

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });


const PORT = 3000;

// --- CONFIG ---
const AWS_ACCESS_KEY = process.env.AWS_ACCESS_KEY;
const AWS_SECRET_KEY = process.env.AWS_SECRET_KEY;
const AWS_REGION = 'eu-west-1';

// --- ROUTES ---

app.get('/', (req, res) => {
    res.send('Amazon MIS Backend is Running');
});

// 3. Convert Excel to CSV
app.post('/api/convert-excel', upload.single('file'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    try {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const csv = XLSX.utils.sheet_to_csv(worksheet);
        res.json({ success: true, csv: csv });
    } catch (error) {
        console.error("Excel Error:", error);
        res.status(500).json({ error: "Failed to parse Excel file" });
    }
});

// --- EXCEL GENERATION ENDPOINT ---
app.post('/api/generate-excel', (req, res) => {
    try {
        const { rows, sheetName } = req.body;
        if (!rows || !Array.isArray(rows)) {
            return res.status(400).json({ error: "Invalid data format" });
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);
        XLSX.utils.book_append_sheet(wb, ws, sheetName || "Report");

        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.set('Content-Disposition', 'attachment; filename=report.xlsx');
        res.send(buffer);

    } catch (err) {
        console.error("Excel Gen Error:", err);
        res.status(500).json({ error: "Failed to generate Excel" });
    }
});

// 2. Fetch Amazon Orders
app.post('/api/fetch-sales', async (req, res) => {
    const { refreshToken, clientId, clientSecret, marketplaceId, dateRange } = req.body;
    const targetMarketplaceId = marketplaceId || 'A2VIGQ35RCS4UG';

    if (!refreshToken || !AWS_ACCESS_KEY) {
        return res.status(400).json({ error: 'Missing Credentials' });
    }

    try {
        console.log("\n📡 Amazon: Exchanging LWA Token...");
        const lwaResp = await axios.post('https://api.amazon.com/auth/o2/token', new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: clientId,
            client_secret: clientSecret
        }));
        const accessToken = lwaResp.data.access_token;

        if (AWS_ACCESS_KEY && AWS_SECRET_KEY && !AWS_ACCESS_KEY.includes('AKIA...')) {
            const aws4 = require('aws4');
            const now = new Date();
            const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const yesterdayStart = new Date(todayStart);
            yesterdayStart.setDate(yesterdayStart.getDate() - 1);

            let createdAfter;
            if (dateRange === '1year') {
                createdAfter = new Date(now);
                createdAfter.setFullYear(createdAfter.getFullYear() - 1);
            } else {
                createdAfter = yesterdayStart;
            }

            const host = 'sellingpartnerapi-eu.amazon.com';
            const opts = {
                service: 'execute-api',
                region: AWS_REGION,
                method: 'GET',
                host: host,
                path: `/orders/v0/orders?CreatedAfter=${createdAfter.toISOString()}&MarketplaceIds=${targetMarketplaceId}`,
                headers: { 'x-amz-access-token': accessToken, 'content-type': 'application/json' }
            };

            aws4.sign(opts, { accessKeyId: AWS_ACCESS_KEY, secretAccessKey: AWS_SECRET_KEY });

            let orders = [];
            try {
                // Initial Fetch with Retry
                let currentResp = await fetchWithRetry(`https://${opts.host}${opts.path}`, { headers: opts.headers });
                orders = currentResp.data.payload.Orders || [];
                let nextToken = currentResp.data.payload.NextToken;
                let pageCount = 0;

                // Pagination Loop (Max 50 pages ~5000 orders)
                while (nextToken && pageCount < 50) {
                    console.log(`   ... Fetching Page ${pageCount + 2}`);
                    const nextOpts = {
                        service: 'execute-api',
                        region: AWS_REGION,
                        method: 'GET',
                        host: host,
                        path: `/orders/v0/orders?NextToken=${encodeURIComponent(nextToken)}`,
                        headers: { 'x-amz-access-token': accessToken, 'content-type': 'application/json' }
                    };
                    aws4.sign(nextOpts, { accessKeyId: AWS_ACCESS_KEY, secretAccessKey: AWS_SECRET_KEY });

                    // Retryable Fetch with more resilience
                    const nextResp = await fetchWithRetry(`https://${nextOpts.host}${nextOpts.path}`, { headers: nextOpts.headers }, 5, 2000);
                    const nextOrders = nextResp.data.payload.Orders || [];
                    orders = orders.concat(nextOrders);
                    nextToken = nextResp.data.payload.NextToken;
                    pageCount++;

                    // Throttling: Wait 2 seconds between pages to respect Amazon Leaky Bucket
                    // Restores burst capacity 
                    await new Promise(r => setTimeout(r, 2000));
                }
                console.log(`   Total Orders Fetched: ${orders.length}`);

            } catch (err) {
                console.error("   Pagination Error (showing partial):", err.message);
                if (orders.length === 0) throw err;
            }

            let todaySales = 0, todayCount = 0, todayFees = 0, todayCost = 0, todayReturns = 0;
            let yesterdaySales = 0, yesterdayCount = 0, yesterdayFees = 0, yesterdayCost = 0, yesterdayReturns = 0;
            let allSales = 0, allCount = 0, allFees = 0, allCost = 0, allReturns = 0;
            const ordersList = [];

            // Process Orders Sequentially to handle Async Financial fetching
            for (const o of orders) {
                if (o.OrderTotal && o.OrderTotal.Amount) {
                    const amount = parseFloat(o.OrderTotal.Amount);
                    const orderDate = new Date(o.PurchaseDate);

                    let estimatedFee = 0;
                    let estimatedCost = 0;
                    let actualFee = null;
                    let feeType = 'Estimated';
                    let feeError = null;

                    // Fetch Actual Fees for Last 365 Days
                    const lookbackDate = new Date(todayStart);
                    lookbackDate.setDate(lookbackDate.getDate() - 365);

                    if (orderDate >= lookbackDate) {
                        try {
                            await new Promise(r => setTimeout(r, 1000)); // Rate Limit spacing (1s)
                            const finances = await getFinancials(o.AmazonOrderId, accessToken);
                            if (finances !== null && !isNaN(finances)) {
                                actualFee = finances;
                                feeType = 'Actual';
                            } else {
                                feeError = 'No financial events found';
                            }
                            console.log(`   Fetched Fees for ${o.AmazonOrderId}: ${actualFee}`);
                        } catch (e) {
                            console.warn(`   Failed to fetch fees for ${o.AmazonOrderId} (${e.message})`);
                            feeError = e.message;
                        }
                    }

                    if (actualFee !== null) {
                        estimatedFee = actualFee;
                    } else {
                        // Fallback Estimation updated to 10% (User data suggests ~8-9%)
                        estimatedFee = amount * 0.10;
                    }

                    if (amount >= 0) {
                        allSales += amount;
                        allFees += estimatedFee;
                        allCount++;

                        if (orderDate >= todayStart) {
                            todaySales += amount; todayCount++; todayFees += estimatedFee;
                        }
                        else if (orderDate >= yesterdayStart && orderDate < todayStart) {
                            yesterdaySales += amount; yesterdayCount++; yesterdayFees += estimatedFee;
                        }
                    } else {
                        allReturns += Math.abs(amount);
                    }

                    ordersList.push({
                        id: o.AmazonOrderId,
                        date: o.PurchaseDate,
                        amount: amount,
                        fees: estimatedFee,
                        cost: estimatedCost,
                        status: o.OrderStatus,
                        currency: o.OrderTotal.CurrencyCode,
                        feeType: feeType,
                        feeError: feeError
                    });
                }
            }

            // Helper for Financials
            async function getFinancials(orderId, token) {
                const fOpts = {
                    service: 'execute-api', region: AWS_REGION, method: 'GET',
                    host: host, path: `/finances/v0/orders/${orderId}/financialEvents`,
                    headers: { 'x-amz-access-token': token, 'content-type': 'application/json' }
                };
                aws4.sign(fOpts, { accessKeyId: AWS_ACCESS_KEY, secretAccessKey: AWS_SECRET_KEY });

                const fRes = await fetchWithRetry(`https://${fOpts.host}${fOpts.path}`, { headers: fOpts.headers }, 3, 2000);
                const events = fRes.data.payload.FinancialEvents;
                let totalFees = 0;

                if (events.ShipmentEventList) {
                    events.ShipmentEventList.forEach(ship => {
                        ship.ShipmentItemList.forEach(item => {
                            if (item.ItemFeeList) {
                                item.ItemFeeList.forEach(fee => {
                                    totalFees += parseFloat(fee.FeeAmount.CurrencyAmount);
                                });
                            }
                        });
                    });
                }
                return Math.abs(totalFees); // Fees are usually negative in API, we want positive magnitude for DB
            }

            res.json({
                success: true,
                data: {
                    today: {
                        sales: todaySales, orders: todayCount,
                        fees: todayFees, cost: todayCost, returns: todayReturns,
                        status: `Synced`
                    },
                    yesterday: {
                        sales: yesterdaySales, orders: yesterdayCount,
                        fees: yesterdayFees, cost: yesterdayCost, returns: yesterdayReturns,
                        status: `Synced`
                    },
                    all: {
                        sales: allSales, orders: allCount,
                        fees: allFees, cost: allCost, returns: allReturns,
                        status: `Synced (${allCount})`
                    },
                    ordersList: ordersList
                }
            });
            return;
        }
        res.json({ success: true, data: { today: { sales: 0, orders: 0, status: "Connected (No Keys)" }, yesterday: { sales: 0, orders: 0, status: "Connected" }, all: { sales: 0, orders: 0, status: "Connected" }, ordersList: [] } });

    } catch (error) {
        console.error("\n❌ Amazon Error:", error.response?.data || error.message);
        res.status(500).json({ error: error.message });
    }
});

// 4. Fetch Noon Orders (New Authenticated Flow)
app.post('/api/fetch-noon-sales', async (req, res) => {
    console.log('\n========== NOON API REQUEST (JWT Auth) ==========');

    // Attempt to load credentials file
    try {
        // 1. Load Creds (Prefer sensitive file)
        let creds = {};
        if (require('fs').existsSync('noon_credentials_sensitive.json')) {
            creds = JSON.parse(require('fs').readFileSync('noon_credentials_sensitive.json', 'utf8'));
        } else if (require('fs').existsSync('noon_credentials.json')) {
            creds = JSON.parse(require('fs').readFileSync('noon_credentials.json', 'utf8'));
        }

        const private_key = creds.private_key || req.body.keySecret;
        const key_id = creds.key_id || req.body.keyId;
        let project_code = creds.project_code || req.body.projectCode || creds.default_project_code;

        // Sanitize Project Code (Remove 'PRJ' or 'p' prefix)
        let cleanProjectCode = project_code;
        if (project_code && typeof project_code === 'string') {
            cleanProjectCode = project_code.replace(/^(PRJ|p)/i, '');
            // console.log(`ℹ️ Auto-corrected Project Code: ${project_code} -> ${cleanProjectCode}`);
        }

        if (!private_key || !key_id) {
            throw new Error("Missing Noon Credentials (Key ID or Private Key).");
        }

        // 2. Create JWT
        const now = Math.floor(Date.now() / 1000) - 5;
        const payload = {
            sub: key_id,
            iat: now,
            jti: String(Date.now()),
        };

        const token = jwt.sign(payload, private_key, { algorithm: "RS256" });
        console.log("🔑 JWT Generated.");

        // 3. Setup Cookie Jar Client
        const jar = new CookieJar();
        const client = wrapper(axios.create({ jar }));

        // 4. Login
        console.log("📡 Logging in to Noon API Gateway...");
        await client.post(
            "https://noon-api-gateway.noon.partners/identity/public/v1/api/login",
            {
                token: token,
                default_project_code: cleanProjectCode,
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
                    "X-Locale": "en-AE",
                    "Origin": "https://noon.partners",
                    "Referer": "https://noon.partners/"
                },
            }
        );
        console.log("✅ Login Successful.");

        // 4. Fetch Data (Try Orders, Fallback to Whoami)
        console.log("📡 Fetching Data...");

        let orders = [];
        let statusMsg = "Synced";

        try {
            // Try fetching orders from Gateway V1
            // Removed status filter to get ALL orders
            // Try fetching orders from User Provided Endpoint
            // https://noon-api-gateway.noon.partners/order/v1/orders
            // OR Direct API: https://api.noon.partners/order/v1/orders

            // We use FBPI Shipment API (POST)
            const orderUrl = 'https://api.noon.partners/fbpi/v1/shipment/get';
            console.log(`📡 Fetching Shipments from: ${orderUrl} (Bearer Auth - POST)`);

            // Credentials for Headers
            const userCode = creds.channel_identifier; // e.g. mukul@p47635...

            const orderResponse = await client.post(orderUrl, {
                // Request Body (Guessing common Filters)
                "limit": 50,
                "offset": 0,
                "status": ["created", "packed", "ready_for_pickup", "picked_up", "shipped", "delivered"]
            }, {
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "X-Partner-Id": userCode,
                    "X-Request-Id": key_id,
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36",
                    "X-Locale": "en-AE",
                    "Origin": "https://noon.partners",
                    "Referer": "https://noon.partners/"
                }
            });
            orders = orderResponse.data.result || orderResponse.data || [];
            if (!Array.isArray(orders)) orders = []; // Safety check
            console.log(`✅ Noon Orders Retrieved: ${orders.length}`);

        } catch (orderErr) {
            console.error(`⚠️ Order Endpoint Failed (${orderErr.response ? orderErr.response.status : orderErr.message}) - URL: /order/v1/orders`);

            // Fallback: Check WhoAmI to confirm credentials are good
            try {
                const whoami = await client.get("https://noon-api-gateway.noon.partners/identity/v1/whoami", {
                    headers: {
                        "Accept": "application/json",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36"
                    }
                });
                console.log("✅ Connection Verified via WhoAmI:", whoami.data.username);
                statusMsg = "Connected - Access Restricted";
            } catch (whoamiErr) {
                console.error("WhoAmI Failed too.");
                throw new Error("Login succeeded but API access failed.");
            }
        }

        // 5. Aggregate (Safe handling of empty orders)
        let todaySales = 0, todayCount = 0, todayFees = 0, todayCost = 0, todayReturns = 0;
        let yesterdaySales = 0, yesterdayCount = 0, yesterdayFees = 0, yesterdayCost = 0, yesterdayReturns = 0;
        let allSales = 0, allCount = 0, allFees = 0, allCost = 0, allReturns = 0;
        const ordersList = [];

        const dateNow = new Date();
        const todayStart = new Date(dateNow.getFullYear(), dateNow.getMonth(), dateNow.getDate());
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);

        orders.forEach(o => {
            const amount = o.total_amount || 0;
            const dateStr = o.order_created_at || o.order_date;
            const orderDate = new Date(dateStr);

            // Estimates
            const estimatedFee = amount * 0.15;
            const estimatedCost = 0;

            allSales += amount;
            allFees += estimatedFee;
            allCost += estimatedCost;
            allCount++;

            ordersList.push({
                id: o.order_id || o.id || 'N/A',
                date: dateStr,
                amount: amount,
                fees: estimatedFee,
                cost: estimatedCost,
                status: o.status,
                currency: o.currency_code || 'AED',
                platform: 'Noon'
            });

            if (orderDate >= todayStart) {
                todaySales += amount; todayCount++; todayFees += estimatedFee;
            } else if (orderDate >= yesterdayStart && orderDate < todayStart) {
                yesterdaySales += amount; yesterdayCount++; yesterdayFees += estimatedFee;
            }
        });

        res.json({
            success: true,
            data: {
                today: {
                    sales: todaySales, orders: todayCount,
                    fees: todayFees, cost: todayCost, returns: todayReturns,
                    status: statusMsg
                },
                yesterday: {
                    sales: yesterdaySales, orders: yesterdayCount,
                    fees: yesterdayFees, cost: yesterdayCost, returns: yesterdayReturns,
                    status: statusMsg
                },
                all: {
                    sales: allSales, orders: allCount,
                    fees: allFees, cost: allCost, returns: allReturns,
                    status: statusMsg
                },
                ordersList: ordersList
            }
        });

    } catch (error) {
        console.error("❌ Noon Error:", error.response?.data || error.message);
        res.json({
            success: false,
            error: error.message,
            errorDetails: error.response?.data,
            data: {
                today: { sales: 0, orders: 0, status: "Error" },
                yesterday: { sales: 0, orders: 0, status: "Error" },
                all: { sales: 0, orders: 0, status: "Error" },
                ordersList: []
            }
        });
    }
});

app.listen(PORT, () => {
    console.log(`\n---------------------------------------------------------`);
    console.log(` SERVER RUNNING: http://localhost:${PORT}`);
    console.log(`---------------------------------------------------------`);
});

// Rate Limit Helper for Resilience
async function fetchWithRetry(url, options, retries = 3, backoff = 1000) {
    try {
        return await require('axios').get(url, options);
    } catch (err) {
        if (retries > 0 && err.response && (err.response.status === 429 || err.response.status >= 500)) {
            console.warn(`⚠️ Request Failed (${err.response.status}). Retrying in ${backoff}ms...`);
            await new Promise(r => setTimeout(r, backoff));
            return fetchWithRetry(url, options, retries - 1, backoff * 2);
        }
        throw err;
    }
}

