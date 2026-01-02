const odooClient = require('./server/odoo_client');

async function test() {
    console.log("Testing fetchRetailStock...");
    try {
        const quants = await odooClient.fetchRetailStock();
        console.log("Success! Quants found:", quants.length);
        if (quants.length > 0) {
            console.log("Sample:", quants[0]);
        }
    } catch (err) {
        console.error("Test Failed:", err);
    }
}

test();
