
const odooClient = require('./odoo_client');

(async () => {
    try {
        console.log("Connecting...");
        await odooClient.connect();

        // 1. Check Product Costs
        console.log("\n--- Checking Product Costs ---");
        const products = await odooClient.fetchProducts(5);
        products.forEach(p => {
            console.log(`SKU: ${p.default_code} | Cost: ${p.standard_price} | Name: ${p.name}`);
        });

        // 2. Check Invoice Fetching (Known Invoice)
        const checkInvoice = async (ref) => {
            console.log(`\n--- Checking Invoice by Ref: ${ref} ---`);
            const res = await odooClient.fetchInvoicesByReferences([ref]);
            const inv = res[ref];
            if (inv) {
                console.log(`✅ Found Invoice: ${inv.name} (ID: ${inv.id})`);
                console.log(`   Total Cost: ${inv.total_cost}`);
                if (inv.lines) {
                    console.log(`   Lines: ${inv.lines.length}`);
                    inv.lines.forEach(l => {
                        console.log(`     - ${l.product_id ? l.product_id[1] : '?'} | Qty: ${l.quantity} | PurchasePrice: ${l.purchase_price}`);
                    });
                }
            } else {
                console.log(`❌ Invoice not found via helper.`);
            }
        };

        await checkInvoice('NAEI10021753637');
        await checkInvoice('SO26089');

    } catch (e) {
        console.error(e);
    }
})();
