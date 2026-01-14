const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'server.js');
let content = fs.readFileSync(filePath, 'utf8');

const startMarker = "// 2. NOON INVENTORY (CIM / Items)";
const endMarker = "// FALLBACK LOGIC: Should theoretically";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker, startIndex);

if (startIndex !== -1 && endIndex !== -1) {
    const newLogic = `    // 2. NOON INVENTORY (Via Odoo Sync)
    // Since Noon CIM API is restricted, we fetch "Live" inventory directly from Odoo
    try {
        console.log("   🔄 Fetching Noon/Retail Inventory from Odoo...");
        const odClient = require('./odoo_client');
        
        // Fetch products with positive quantity
        const odooProds = await odClient.fetchProducts(500, 0, [['qty_available', '>', 0]]);
        
        if (odooProds && odooProds.length > 0) {
            console.log(\`   ✅ Fetched \${odooProds.length} Stocked Items from Odoo.\`);
            
            odooProds.forEach(p => {
                inventory.push({
                    platform: 'Noon', 
                    sku: p.default_code || 'UNKNOWN',
                    name: p.name,
                    category: p.categ_id ? (Array.isArray(p.categ_id) ? p.categ_id[1] : 'Product') : 'General',
                    qty: p.qty_available,
                    status: 'Active'
                });
            });
        }
    } catch (noonErr) {
        console.error("   ❌ Noon Inventory (Odoo) Failed:", noonErr.message);
    }

    `;

    const finalContent = content.substring(0, startIndex) + newLogic + content.substring(endIndex);
    fs.writeFileSync(filePath, finalContent, 'utf8');
    console.log("✅ Successfully replaced Noon Inventory logic with Odoo Sync.");
} else {
    console.error("❌ Markers not found in server.js");
    console.log("Start Index:", startIndex);
    console.log("End Index:", endIndex);
}
