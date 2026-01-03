
const odooClient = require('./odoo_client');

(async () => {
    try {
        console.log("Connecting...");
        await odooClient.connect();

        const id = '407-0657030-0606711';
        console.log(`Exhaustive search for: ${id}`);

        const client = odooClient.rpcConfig.secure
            ? require('xmlrpc').createSecureClient({ ...odooClient.rpcConfig, path: '/xmlrpc/2/object' })
            : require('xmlrpc').createClient({ ...odooClient.rpcConfig, path: '/xmlrpc/2/object' });

        // Search in Sale Order first?
        console.log("Checking Sale Orders (sale.order)...");
        const soDomain = ['|', '|', ['name', 'ilike', id], ['client_order_ref', 'ilike', id], ['origin', 'ilike', id]];
        const sos = await new Promise((res, rej) => {
            client.methodCall('execute_kw', [odooClient.db, odooClient.uid, odooClient.password, 'sale.order', 'search_read', [soDomain],
            { fields: ['name', 'client_order_ref', 'origin', 'state'] }
            ], (e, r) => e ? rej(e) : res(r));
        });
        if (sos.length > 0) {
            console.log("Found Sale Orders:", sos);
        } else {
            console.log("No Sale Orders found.");
        }

        // Search Invoices
        console.log("Checking Invoices (account.invoice)...");
        const invDomain = ['|', '|', ['name', 'ilike', id], ['reference', 'ilike', id], ['origin', 'ilike', id]];
        // Note: 'comment' field might not be searchable or exist in standard view depending on version
        const invs = await new Promise((res, rej) => {
            client.methodCall('execute_kw', [odooClient.db, odooClient.uid, odooClient.password, 'account.invoice', 'search_read', [invDomain],
            { fields: ['name', 'reference', 'origin', 'state'] }
            ], (e, r) => e ? rej(e) : res(r));
        });
        if (invs.length > 0) {
            console.log("Found Invoices:", invs);
        } else {
            console.log("No Invoices found.");
        }

    } catch (e) {
        console.error(e);
    }
})();
