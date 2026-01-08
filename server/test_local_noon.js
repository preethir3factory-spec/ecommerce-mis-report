const axios = require('axios');

(async () => {
    try {
        console.log("🚀 Testing Local Backend Endpoint: /api/fetch-noon-sales");

        const response = await axios.post('http://localhost:3000/api/fetch-noon-sales', {
            dateRange: '30days'
        });

        console.log("✅ Response Status:", response.status);
        if (response.data.success) {
            console.log("📦 Data Received:");
            const d = response.data.data;
            console.log(`   Today Sales: ${d.today.sales} (Orders: ${d.today.orders})`);
            console.log(`   Yesterday Sales: ${d.yesterday.sales}`);
            console.log(`   Total Orders in List: ${d.ordersList.length}`);
            if (d.ordersList.length > 0) {
                console.log("   Sample Order:", d.ordersList[0]);
            }
        } else {
            console.error("❌ API returned success: false");
            console.error("   Error:", response.data.error);
        }

    } catch (error) {
        console.error("❌ Test Failed:", error.message);
        if (error.response) {
            console.error("   Status:", error.response.status);
            console.error("   Data:", error.response.data);
        }
    }
})();
