const xmlrpc = require('xmlrpc');
require('dotenv').config();

const urlParams = new URL(process.env.ODOO_URL || 'http://localhost');
const rpcConfig = {
    host: urlParams.hostname,
    port: urlParams.port || (urlParams.protocol === 'https:' ? 443 : 80),
    path: '/xmlrpc/2/',
    secure: urlParams.protocol === 'https:'
};

const client = rpcConfig.secure
    ? xmlrpc.createSecureClient({ ...rpcConfig, path: '/xmlrpc/2/object' })
    : xmlrpc.createClient({ ...rpcConfig, path: '/xmlrpc/2/object' });

const common = rpcConfig.secure
    ? xmlrpc.createSecureClient({ ...rpcConfig, path: '/xmlrpc/2/common' })
    : xmlrpc.createClient({ ...rpcConfig, path: '/xmlrpc/2/common' });

(async () => {
    try {
        const uid = await new Promise((resolve, reject) => {
            common.methodCall('authenticate', [process.env.ODOO_DB, process.env.ODOO_USERNAME, process.env.ODOO_PASSWORD, {}], (err, uid) => {
                if (err) reject(err); else resolve(uid);
            });
        });

        console.log("Authenticated with UID:", uid);

        // Target Serial Number from Screenshot
        const targetSerial = '350196696625146';

        // 1. Search for the Lot
        console.log(`\nSearching for Lot: ${targetSerial} in stock.production.lot ...`);
        client.methodCall('execute_kw', [
            process.env.ODOO_DB, uid, process.env.ODOO_PASSWORD,
            'stock.production.lot',
            'search_read',
            [[['name', '=', targetSerial]]],
            { fields: [], limit: 1 } // Fetch all fields to find the cost one
        ], (err, lots) => {
            if (err) {
                console.error("Error fetching lot:", err);
            } else if (lots.length > 0) {
                console.log("✅ Found Lot:");
                console.log(JSON.stringify(lots[0], null, 2));

                // Look for cost-like fields
                const keys = Object.keys(lots[0]);
                const costFields = keys.filter(k => k.includes('cost') || k.includes('price') || k.includes('standard'));
                console.log("\nPotential Cost Fields:", costFields);
            } else {
                console.log("❌ Lot not found.");
            }
        });

    } catch (e) {
        console.error("Script Error:", e);
    }
})();
