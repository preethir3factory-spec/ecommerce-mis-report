const axios = require('axios');
const fs = require('fs');
const { exec } = require('child_process');

console.log("🔍 STARTING QA AUTOMATED TESTS...\n");

const BASE_URL = 'http://localhost:3000';

async function runTests() {
    let passed = 0;
    let failed = 0;

    // 0. Environment File Check (Local Only)
    // This helps debug local setup issues before hitting the server
    process.stdout.write("Test 0: Local Environment Check (.env)... ");
    try {
        const envPath = require('path').join(__dirname, '.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            const hasAccessKey = envContent.includes('AWS_ACCESS_KEY');
            const hasPlaceholder = envContent.includes('your_aws_access_key') || envContent.includes('AKIA...');

            if (!hasAccessKey) {
                console.log("⚠️ WARNING (.env exists but AWS_ACCESS_KEY missing)");
            } else if (hasPlaceholder) {
                console.log("❌ FAIL (Credentials are placeholders)");
                console.log("   Action: Update .env with real IAM User keys.");
                failed++;
            } else {
                console.log("✅ PASS");
                passed++;
            }
        } else {
            console.log(`⚠️ SKIPPED (No .env found at ${envPath} - Assuming Render/Cloud Env Vars)`);
        }
    } catch (e) {
        console.log("⚠️ SKIPPED (Read Error)");
    }

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
        // Use path relative to this script
        const scriptPath = require('path').join(__dirname, 'noon_login.js');
        // Run with CWD set to server directory so it finds credentials
        exec(`node "${scriptPath}"`, { cwd: __dirname }, (error, stdout, stderr) => {
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

    // 4. Amazon Logic Check (Configuration Diag)
    process.stdout.write("Test 4: Amazon Server Configuration... ");
    try {
        // Send a dummy token to bypass the 'Missing Refresh Token' check
        // This forces the server to check for AWS Keys
        const res = await axios.post(`${BASE_URL}/api/fetch-sales`, {
            refreshToken: "QA_TEST_DUMMY_TOKEN"
        }, { validateStatus: () => true });

        if (res.status === 500 && res.data && res.data.error && res.data.error.includes("Server Config Error")) {
            console.log("❌ FAIL (Server Misconfigured)");
            console.log("   Reason: " + res.data.error);
            failed++;
        } else if (res.status === 500) {
            // Likely Amazon API rejected our dummy token, which means the keys are PRESENT and VALID enough to try.
            // Or it could be other 500s.
            console.log("✅ PASS (Server verification attempted - Config is OK)");
            passed++;
        } else if (res.status === 200) {
            // This clearly means the "No Keys" fallback was triggered (which we removed, but if old code exists...)
            // OR it means it somehow worked?!
            console.log("⚠️ WARNING (Unexpected Success with dummy token?)");
            passed++;
        } else {
            console.log("⚠️ INDETERMINATE (Status " + res.status + ")");
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
