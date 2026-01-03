
const odooClient = require('./odoo_client');

(async () => {
    try {
        console.log("Connecting to Odoo...");
        await odooClient.connect();
        console.log("Connected.");

        const client = odooClient.rpcConfig.secure
            ? require('xmlrpc').createSecureClient({ ...odooClient.rpcConfig, path: '/xmlrpc/2/object' })
            : require('xmlrpc').createClient({ ...odooClient.rpcConfig, path: '/xmlrpc/2/object' });

        // 1. Check recent invoices to verify DB connection and data presence
        console.log("Checking recent invoices from 2026...");
        const dateDomain = [['date_invoice', '>=', '2026-01-01']];

        await new Promise((resolve, reject) => {
            client.methodCall('execute_kw', [odooClient.db, odooClient.uid, odooClient.password, 'account.invoice', 'search_read', [dateDomain],
            { fields: ['name', 'reference', 'origin', 'date_invoice'], limit: 5 }
            ], (error, invoices) => {
                if (error) console.error("Recent Check Error:", error);
                else {
                    console.log(`Found ${invoices.length} recent invoices.`);
                    invoices.forEach(i => console.log(`   ${i.name} | ${i.reference} | ${i.origin} | ${i.date_invoice}`));
                }
                resolve();
            });
        });

        // 2. Search partial ID
        const partialId = '0606711';
        console.log(`\nSearching for partial ID: ${partialId}`);
        const partialDomain = ['|', '|', ['name', 'ilike', partialId], ['reference', 'ilike', partialId], ['origin', 'ilike', partialId]];

        await new Promise((resolve, reject) => {
            client.methodCall('execute_kw', [odooClient.db, odooClient.uid, odooClient.password, 'account.invoice', 'search_read', [partialDomain],
            { fields: ['name', 'reference', 'origin', 'state', 'partner_id', 'amount_total'] }
            ], (error, invoices) => {
                if (error) {
                    console.error("Error:", error);
                    reject(error);
                } else {
                    console.log(`Found ${invoices.length} invoices matching partial ${partialId}`);
                    invoices.forEach(inv => {
                        console.log("------------------------------------------------");
                        console.log(`ID: ${inv.id}`);
                        console.log(`Name: ${inv.name}`);
                        console.log(`Reference: ${inv.reference}`);
                        console.log(`Origin: ${inv.origin}`);
                        console.log(`Partner: ${inv.partner_id}`);
                    });
                    resolve();
                }
            });
        });

    } catch (e) {
        console.error("Top Level Error:", e);
    }
})();
