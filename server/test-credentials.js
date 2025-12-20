require('dotenv').config();

console.log('=== Amazon SP-API Credentials Check ===\n');

// Check if credentials exist
const checks = {
    'AWS_ACCESS_KEY': process.env.AWS_ACCESS_KEY,
    'AWS_SECRET_KEY': process.env.AWS_SECRET_KEY,
    'CLIENT_ID': process.env.CLIENT_ID,
    'CLIENT_SECRET': process.env.CLIENT_SECRET
};

let allPresent = true;

for (const [key, value] of Object.entries(checks)) {
    if (!value || value.includes('your_') || value.includes('here')) {
        console.log(`❌ ${key}: NOT SET or still has placeholder value`);
        allPresent = false;
    } else {
        console.log(`✅ ${key}: Set (${value.substring(0, 8)}...)`);
    }
}

console.log('\n=== Test Amazon API Connection ===\n');

if (!allPresent) {
    console.log('⚠️  Please update your .env file with real credentials first!\n');
    process.exit(1);
}

// Test API call
const axios = require('axios');
const aws4 = require('aws4');

async function testConnection() {
    try {
        const marketplaceId = 'A2VIGQ35RCS4UG'; // UAE
        const endpoint = `https://sellingpartnerapi-eu.amazon.com/orders/v0/orders?MarketplaceIds=${marketplaceId}&CreatedAfter=2024-01-01T00:00:00Z`;

        const request = {
            host: 'sellingpartnerapi-eu.amazon.com',
            method: 'GET',
            url: endpoint,
            path: `/orders/v0/orders?MarketplaceIds=${marketplaceId}&CreatedAfter=2024-01-01T00:00:00Z`,
            headers: {
                'x-amz-access-token': 'test-token', // Will fail but shows if signing works
                'host': 'sellingpartnerapi-eu.amazon.com'
            },
            region: 'eu-west-1',
            service: 'execute-api'
        };

        aws4.sign(request, {
            accessKeyId: process.env.AWS_ACCESS_KEY,
            secretAccessKey: process.env.AWS_SECRET_KEY
        });

        console.log('📡 Attempting connection to Amazon SP-API...\n');

        const response = await axios({
            method: request.method,
            url: request.url,
            headers: request.headers
        });

        console.log('✅ SUCCESS! API is reachable.');
        console.log('Response:', response.data);

    } catch (error) {
        if (error.response) {
            console.log(`⚠️  API Response Error: ${error.response.status}`);
            console.log('Message:', error.response.data);

            if (error.response.status === 403) {
                console.log('\n🔴 ISSUE: Access Denied (403)');
                console.log('This usually means:');
                console.log('1. Your AWS IAM user lacks the required policy');
                console.log('2. Your LWA Refresh Token is missing/invalid');
                console.log('3. Your app is not authorized for SP-API\n');
                console.log('📖 See AMAZON_LIVE_SETUP.md for IAM policy setup');
            } else if (error.response.status === 401) {
                console.log('\n🔴 ISSUE: Unauthorized (401)');
                console.log('Your AWS credentials are incorrect or expired.');
            }
        } else {
            console.log('❌ Network Error:', error.message);
        }
    }
}

testConnection();
