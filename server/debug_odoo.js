const odooClient = require('./odoo_client');

(async () => {
    console.log("🔍 Debugging Odoo Matches for Amazon Orders...");

    const sampleOrderIds = [
        '407-5944987-9229125',
        '171-6414065-3521934',
        '171-4394550-8766721'
    ];

    try {
        console.log(`\n1. Testing fetchInvoicesByReferences with: ${sampleOrderIds.join(', ')}`);
        const result = await odooClient.fetchInvoicesByReferences(sampleOrderIds);

        console.log("   Result Size:", Object.keys(result).length);
        if (Object.keys(result).length > 0) {
            console.log("   Matches Found:", JSON.stringify(result, null, 2));
        } else {
            console.log("   ❌ No Invoice Matches Found via 'ref'.");
            console.log("   (This explains why columns are empty if Fallback also fails)");
        }

    } catch (e) {
        console.error("   Error:", e.message);
    }
})();
