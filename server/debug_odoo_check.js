const odoo = require('./odoo_client');

(async () => {
    console.log("🔍 Debugging Odoo Connection for 'Telco D DWC LLC'...");
    try {
        const partnerId = await odoo.fetchPartnerId('Telco D DWC LLC');
        console.log(`👤 Partner ID for 'Telco D DWC LLC': ${partnerId}`);

        if (partnerId) {
            const orders = await odoo.fetchSalesOrdersByPartner('Telco D DWC LLC', 5);
            console.log(`📦 Found ${orders.length} orders.`);
            if (orders.length > 0) {
                console.log("Sample Order:", JSON.stringify(orders[0], null, 2));
            } else {
                console.log("⚠️ No orders found for this partner.");
            }
        } else {
            console.log("❌ Partner not found. Attempting fuzzy search...");
            const locations = await odoo.searchLocations('Telco');
            console.log("Locations/Partners match?", locations);
            // wait, searchLocations searches stock.location. 
            // We need to check res.partner names.
        }
    } catch (e) {
        console.error("❌ Error:", e);
    }
})();
