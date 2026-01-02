const odooClient = require('./server/odoo_client');

async function debugCounts() {
    console.log("Debugging Odoo Counts...");
    try {
        if (!odooClient.uid) await odooClient.connect();
        const client = odooClient.rpcConfig.secure ? require('xmlrpc').createSecureClient({ ...odooClient.rpcConfig, path: '/xmlrpc/2/object' }) : require('xmlrpc').createClient({ ...odooClient.rpcConfig, path: '/xmlrpc/2/object' });

        // 1. Count Lots with x_parent_loc = 'retail_loc'
        const lotIds = await new Promise((resolve, reject) => {
            client.methodCall('execute_kw', [odooClient.db, odooClient.uid, odooClient.password, 'stock.production.lot', 'search',
            [[['x_parent_loc', '=', 'retail_loc']]]
            ], (err, ids) => {
                if (err) reject(err); else resolve(ids);
            });
        });
        console.log(`Lots with x_parent_loc='retail_loc': ${lotIds.length}`);

        if (lotIds.length === 0) return;

        // 2. Count Quants for these lots (quantity > 0)
        const quants = await new Promise((resolve, reject) => {
            client.methodCall('execute_kw', [odooClient.db, odooClient.uid, odooClient.password, 'stock.quant', 'search_count',
            [[['lot_id', 'in', lotIds], ['quantity', '>', 0]]]
            ], (err, count) => {
                if (err) reject(err); else resolve(count);
            });
        });
        console.log(`Quants with quantity > 0 for these lots: ${quants}`);

        // 3. Count Quants with internal location usage
        const internalQuants = await new Promise((resolve, reject) => {
            client.methodCall('execute_kw', [odooClient.db, odooClient.uid, odooClient.password, 'stock.quant', 'search_count',
            [[['lot_id', 'in', lotIds], ['quantity', '>', 0], ['location_id.usage', '=', 'internal']]]
            ], (err, count) => {
                if (err) reject(err); else resolve(count);
            });
        });
        console.log(`Quants with quantity > 0 AND location.usage='internal': ${internalQuants}`);

    } catch (err) {
        console.error("Debug Failed:", err);
    }
}

debugCounts();
