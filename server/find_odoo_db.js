const xmlrpc = require('xmlrpc');

const urlParams = new URL('https://erp.r3factory.com/');
const client = xmlrpc.createSecureClient({
    host: urlParams.hostname,
    port: 443,
    path: '/xmlrpc/2/db'
});

console.log("Attempting to list databases from " + urlParams.hostname + "...");

client.methodCall('list', [], (error, dbs) => {
    if (error) {
        console.error('Error listing databases:', error);
    } else {
        console.log('Databases found:', JSON.stringify(dbs));
    }
});
