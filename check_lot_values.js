const odooClient = require('./server/odoo_client');

async function checkLotValues() {
    console.log("Checking x_parent_loc values...");
    try {
        if (!odooClient.uid) await odooClient.connect();
        const client = odooClient.rpcConfig.secure ? require('xmlrpc').createSecureClient({ ...odooClient.rpcConfig, path: '/xmlrpc/2/object' }) : require('xmlrpc').createClient({ ...odooClient.rpcConfig, path: '/xmlrpc/2/object' });

        const lots = await new Promise((resolve, reject) => {
            client.methodCall('execute_kw', [
                odooClient.db, odooClient.uid, odooClient.password,
                'stock.production.lot', 'search_read',
                [[['x_parent_loc', '!=', false]]],
                { fields: ['name', 'x_parent_loc'], limit: 10 }
            ], (err, res) => {
                if (err) reject(err); else resolve(res);
            });
        });

        console.log("Found lots with set parent location:");
        lots.forEach(l => console.log(`- ${l.name}: ${l.x_parent_loc}`));

    } catch (err) {
        console.error("Check Failed:", err);
    }
}

checkLotValues();
