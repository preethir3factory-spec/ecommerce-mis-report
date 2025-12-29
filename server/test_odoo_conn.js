const odoo = require('./odoo_client');

async function testConnection() {
    try {
        console.log("Connecting to Odoo...");
        const products = await odoo.fetchProducts(5);
        console.log("Successfully fetched " + products.length + " products.");
        if (products.length > 0) {
            console.log("Sample Data:", products[0]);
        }
    } catch (err) {
        console.error("Connection Failed:", err);
    }
}

testConnection();
