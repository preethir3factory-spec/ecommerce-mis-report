// Quick Test: Add sample data to verify tabs work

console.log('🧪 Testing Extension Data Flow...');

// Simulate what happens after you upload CSV or sync API
const testData = {
    today: {
        amazon: { sales: 150.50, cost: 80.00, fees: 20.00, returns: 5.00, sold: 10, liveSkus: 50, totalSkus: 100, weekly: [20, 30, 40, 50, 60, 70, 80] },
        noon: { sales: 200.75, cost: 100.00, fees: 30.00, returns: 10.00, sold: 15, liveSkus: 30, totalSkus: 60, weekly: [15, 25, 35, 45, 55, 65, 75] }
    },
    yesterday: {
        amazon: { sales: 120.00, cost: 60.00, fees: 15.00, returns: 3.00, sold: 8, liveSkus: 50, totalSkus: 100, weekly: [10, 20, 30, 40, 50, 60, 70] },
        noon: { sales: 180.00, cost: 90.00, fees: 25.00, returns: 8.00, sold: 12, liveSkus: 30, totalSkus: 60, weekly: [12, 22, 32, 42, 52, 62, 72] }
    },
    all: {
        amazon: { sales: 5000.00, cost: 2500.00, fees: 500.00, returns: 100.00, sold: 250, liveSkus: 50, totalSkus: 100, weekly: [100, 150, 200, 250, 300, 350, 400] },
        noon: { sales: 7500.00, cost: 3750.00, fees: 750.00, returns: 150.00, sold: 375, liveSkus: 30, totalSkus: 60, weekly: [120, 180, 240, 300, 360, 420, 480] }
    }
};

// Save to Chrome storage
if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.set({ misData: testData }, () => {
        console.log('✅ Test data saved! Reload the extension popup to see it.');
        console.log('📊 Data Summary:');
        console.log('  Today - Amazon: $' + testData.today.amazon.sales);
        console.log('  Today - Noon: $' + testData.today.noon.sales);
        console.log('  All Time - Amazon: $' + testData.all.amazon.sales);
        console.log('  All Time - Noon: $' + testData.all.noon.sales);
    });
} else {
    console.log('❌ Chrome storage not available. Run this in the extension context.');
}
