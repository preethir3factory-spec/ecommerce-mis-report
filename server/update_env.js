const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
let content = '';
try {
    content = fs.readFileSync(envPath, 'utf8');
} catch (e) { console.log('No .env found, creating one.'); }

const newConfig = {
    ODOO_URL: 'https://erp.r3factory.com/',
    ODOO_DB: 'r3_erp_db',
    ODOO_USERNAME: 'preethi@r3factory.ae',
    ODOO_PASSWORD: 'preethi@r3'
};

let lines = content.split('\n');
const newLines = [];
const keysFound = {};

lines.forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        const key = match[1].trim();
        if (newConfig[key] !== undefined) {
            newLines.push(`${key}=${newConfig[key]}`);
            keysFound[key] = true;
        } else {
            newLines.push(line);
        }
    } else {
        newLines.push(line);
    }
});

Object.keys(newConfig).forEach(key => {
    if (!keysFound[key]) {
        newLines.push(`${key}=${newConfig[key]}`);
    }
});

fs.writeFileSync(envPath, newLines.join('\n'));
console.log('Updated .env successfully');
