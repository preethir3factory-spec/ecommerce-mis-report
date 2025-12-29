const odooClient = require('./odoo_client');

(async () => {
    console.log("🔍 Listing Recent Odoo Invoices to check 'ref' format...");

    // We need to access the client internally or add a helper, 
    // but odooClient doesn't expose a generic 'search' easily.
    // I'll reuse fetchInvoicesByReferences but pass a wide search? No, it takes specific list.

    // I will use the internal methodCall via a temporary dirty hack or just instantiate a client here.
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

    // Authenticate first
    const common = rpcConfig.secure
        ? xmlrpc.createSecureClient({ ...rpcConfig, path: '/xmlrpc/2/common' })
        : xmlrpc.createClient({ ...rpcConfig, path: '/xmlrpc/2/common' });

    common.methodCall('authenticate', [process.env.ODOO_DB, process.env.ODOO_USERNAME, process.env.ODOO_PASSWORD, {}], (err, uid) => {
        if (err) { console.error("Auth Error", err); return; }

        console.log("✅ Authenticated. Fetching last 5 invoices...");

        client.methodCall('execute_kw', [
            process.env.ODOO_DB,
            uid,
            process.env.ODOO_PASSWORD,
            'account.invoice',
            'search_read',
            [['|', '|', ['name', 'ilike', '407-5944987-9229125'], ['origin', 'ilike', '407-5944987-9229125'], ['reference', 'ilike', '407-5944987-9229125']]],
            { fields: ['name', 'origin', 'reference', 'state', 'amount_total'], limit: 5 }
        ], (err, invoices) => {
            if (err) console.error(err);
            else {
                console.log(JSON.stringify(invoices, null, 2));
            }
        });
    });

})();
