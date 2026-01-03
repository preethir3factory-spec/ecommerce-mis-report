
const odooClient = require('./odoo_client');

(async () => {
    try {
        console.log("Connecting...");
        await odooClient.connect();

        const id = '407-0657030-0606711';
        console.log(`Testing fetchInvoicesByReferences for: ${id}`);

        const res = await odooClient.fetchInvoicesByReferences([id]);

        if (res[id]) {
            const inv = res[id];
            console.log("✅ SUCCESS! Invoice Found.");
            console.log(`   ID: ${inv.id}`);
            console.log(`   Name: ${inv.name}`);
            console.log(`   Origin: ${inv.origin}`);
            console.log(`   Total Cost: ${inv.total_cost}`);
        } else {
            console.log("❌ FAILED. Invoice still not matched.");
            console.log("Result Map Keys:", Object.keys(res));
        }

    } catch (e) {
        console.error(e);
    }
})();
