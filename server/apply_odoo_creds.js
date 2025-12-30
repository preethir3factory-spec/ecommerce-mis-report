const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
let envContent = '';

if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf8');
}

const newCreds = {
    ODOO_URL: 'https://erp.r3factory.com/',
    ODOO_DB: 'r3_erp_db',
    ODOO_USERNAME: 'preethi@r3factory.ae',
    ODOO_PASSWORD: 'preethi@r3'
};

let lines = envContent.split('\n');
const keys = Object.keys(newCreds);

// Remove existing keys
lines = lines.filter(line => {
    const key = line.split('=')[0].trim();
    return !keys.includes(key);
});

// Append new keys
keys.forEach(key => {
    lines.push(`${key}=${newCreds[key]}`);
});

// Filter out empty lines
lines = lines.filter(l => l.trim() !== '');

fs.writeFileSync(envPath, lines.join('\n') + '\n');
console.log("Updated .env with Odoo credentials.");
