
const odooClient = require('./odoo_client');

(async () => {
    try {
        console.log("Connecting...");
        await odooClient.connect();

        const origin = 'SO26082';
        console.log(`Searching Invoice for Origin: ${origin}`);

        const client = odooClient.rpcConfig.secure
            ? require('xmlrpc').createSecureClient({ ...odooClient.rpcConfig, path: '/xmlrpc/2/object' })
            : require('xmlrpc').createClient({ ...odooClient.rpcConfig, path: '/xmlrpc/2/object' });

        const domain = [['origin', '=', origin]];

        const invs = await new Promise((res, rej) => {
            client.methodCall('execute_kw', [odooClient.db, odooClient.uid, odooClient.password, 'account.invoice', 'search_read', [domain],
            { fields: ['name', 'reference', 'origin', 'state', 'amount_total'] }
            ], (e, r) => e ? rej(e) : res(r));
        });

        console.log("Invoices:", invs);

    } catch (e) {
        console.error(e);
    }
})();
