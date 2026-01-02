const odooClient = require('./server/odoo_client');

async function inspectLotFields() {
    console.log("Inspecting fields of stock.production.lot...");
    try {
        if (!odooClient.uid) await odooClient.connect();
        const client = odooClient.rpcConfig.secure ? require('xmlrpc').createSecureClient({ ...odooClient.rpcConfig, path: '/xmlrpc/2/object' }) : require('xmlrpc').createClient({ ...odooClient.rpcConfig, path: '/xmlrpc/2/object' });

        const fields = await new Promise((resolve, reject) => {
            client.methodCall('execute_kw', [
                odooClient.db, odooClient.uid, odooClient.password,
                'stock.production.lot', 'fields_get',
                [],
                { attributes: ['string', 'type', 'name'] }
            ], (err, res) => {
                if (err) reject(err); else resolve(res);
            });
        });

        console.log("Fields found:");
        // Filter for fields that contain "Location" or "Retail" in their string label
        Object.keys(fields).forEach(key => {
            const f = fields[key];
            if (f.string.includes('Location') || f.string.includes('Retail') || key.includes('loc')) {
                console.log(`- ${key} (${f.string}) [${f.type}]`);
            }
        });

    } catch (err) {
        console.error("Inspection Failed:", err);
    }
}

inspectLotFields();
