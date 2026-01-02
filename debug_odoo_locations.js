const odooClient = require('./server/odoo_client');

async function debug() {
    console.log("Listing first 50 Locations...");
    try {
        if (!odooClient.uid) await odooClient.connect();
        const client = odooClient.rpcConfig.secure ? require('xmlrpc').createSecureClient({ ...odooClient.rpcConfig, path: '/xmlrpc/2/object' }) : require('xmlrpc').createClient({ ...odooClient.rpcConfig, path: '/xmlrpc/2/object' });

        const locs = await new Promise((resolve, reject) => {
            client.methodCall('execute_kw', [
                odooClient.db, odooClient.uid, odooClient.password,
                'stock.location', 'search_read',
                [[]],
                { fields: ['name', 'complete_name'], limit: 50 }
            ], (err, res) => {
                if (err) reject(err); else resolve(res);
            });
        });

        console.log("Found Locations:");
        locs.forEach(l => console.log(`- [${l.id}] ${l.name} (${l.complete_name})`));

    } catch (err) {
        console.error("Debug Failed:", err);
    }
}

debug();
