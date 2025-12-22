const axios = require('axios');

async function testScraper() {
    try {
        console.log("Testing API...");
        const response = await axios.post('http://localhost:3000/api/fetch-market-trends');
        console.log("Status:", response.status);
        console.log("Data:", JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error("Error:", error.message);
        if (error.response) {
            console.error("Response data:", error.response.data);
        }
    }
}

testScraper();
