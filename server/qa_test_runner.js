const axios = require('axios');
const fs = require('fs');
const { exec } = require('child_process');

console.log("🔍 STARTING QA AUTOMATED TESTS...\n");

const BASE_URL = 'http://localhost:3000';

async function runTests() {
    let passed = 0;
    let failed = 0;

    // 1. Server Connectivity
    try {
        process.stdout.write("Test 1: Server Connectivity... ");
        const res = await axios.get(BASE_URL);
        if (res.status === 200) {
            console.log("✅ PASS");
            passed++;
        } else {
            console.log("❌ FAIL (Status " + res.status + ")");
            failed++;
        }
    } catch (err) {
        console.log("❌ FAIL (Server not running or blocking connection)");
        console.log("   Suggestion: Restart 'server.js'");
        failed++;
        // If server is down, excel test will fail too, but we continue.
    }

    // 2. Noon Authentication Script
    process.stdout.write("Test 2: Noon Authentication (Script)... ");
    await new Promise(resolve => {
        exec('node noon_login.js', (error, stdout, stderr) => {
            if (error) {
                console.log("❌ FAIL");
                console.log("   Error Log:\n" + stderr);
                failed++;
            } else if (stdout.includes('Login successful') || stdout.includes('Login OK') || stdout.includes('WhoAmI Data')) {
                console.log("✅ PASS");
                passed++;
            } else {
                console.log("⚠️ INDETERMINATE");
                console.log("   Output:\n" + stdout);
                failed++;
            }
            resolve();
        });
    });

    // 3. Excel Generation Endpoint
    process.stdout.write("Test 3: Excel Generation Endpoint... ");
    try {
        const payload = {
            sheetName: "QA_Test",
            rows: [
                ["ID", "Date", "Amount", "Platform"],
                ["101", "2025-01-01", "100", "Amazon"],
                ["102", "2025-01-01", "200", "Noon"]
            ]
        };
        const res = await axios.post(`${BASE_URL}/api/generate-excel`, payload, { responseType: 'arraybuffer' });
        if (res.status === 200 && res.headers['content-type'].includes('spreadsheetml')) {
            console.log("✅ PASS");
            passed++;
        } else {
            console.log("❌ FAIL (Invalid Response)");
            failed++;
        }
    } catch (err) {
        console.log("❌ FAIL (" + err.message + ")");
        failed++;
    }

    // 4. Amazon Logic Check (Static)
    // We can't hit live Amazon API without active User Credentials.
    // Instead we check if the Endpoint exists.
    process.stdout.write("Test 4: Amazon Endpoint Existence... ");
    try {
        // Sending invalid method to verify route exists (should be 404 for GET, or 400 for POST missing data)
        // Actually sending valid POST with empty body should return 400 Missing Credentials
        const res = await axios.post(`${BASE_URL}/api/fetch-sales`, {}, { validateStatus: () => true });
        if (res.status === 400) {
            console.log("✅ PASS (Route active, handled empty creds correctly)");
            passed++;
        } else {
            console.log("❌ FAIL (Unexpected Status " + res.status + ")");
            failed++;
        }
    } catch (err) {
        console.log("❌ FAIL (" + err.message + ")");
        failed++;
    }

    console.log(`\n---------------------------------`);
    console.log(`QA SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log(`---------------------------------`);
}

runTests();
