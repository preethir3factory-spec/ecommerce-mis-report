window.onerror = function (msg, url, line) {
    const d = document.createElement('div');
    d.style.color = 'red';
    d.innerText = `JS Error: ${msg} (Line ${line})`;
    document.body.appendChild(d);

    const consoleDiv = document.getElementById('debug-console');
    if (consoleDiv) {
        const log = document.createElement('div');
        log.style.color = 'red';
        log.innerText = `[System Error] ${msg} at line ${line}`;
        consoleDiv.appendChild(log);
    }
};

alert("Market Trends Script Loaded!");
console.log('Script Started');

const fetchBtn = document.getElementById('fetch-btn');
const loading = document.getElementById('loading');
const amazonList = document.getElementById('amazon-list');
const noonList = document.getElementById('noon-list');
const statusBar = document.getElementById('status-bar');
const downloadBtn = document.getElementById('download-btn');
const debugConsole = document.getElementById('debug-console');

function log(msg) {
    console.log(msg);
    if (debugConsole) {
        const d = document.createElement('div');
        d.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
        debugConsole.appendChild(d);
        debugConsole.scrollTop = debugConsole.scrollHeight;
    }
}

let currentData = { amazon: [], noon: [] };

// Auto-fetch immediately
if (fetchBtn) fetchBtn.addEventListener('click', fetchMarketData);
fetchMarketData();

async function fetchMarketData() {
    if (loading) loading.style.display = 'flex';
    log("Fetching data from http://localhost:3000/api/fetch-market-trends...");
    if (amazonList) amazonList.innerHTML = '<div style="padding:20px; text-align:center;">Loading...</div>';
    if (noonList) noonList.innerHTML = '<div style="padding:20px; text-align:center;">Loading...</div>';

    try {
        // const API_URL = 'https://ecommerce-mis-report.onrender.com/api/fetch-market-trends'; // Production
        const API_URL = 'http://localhost:3000/api/fetch-market-trends'; // Local Development

        const resp = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        log(`Response Status: ${resp.status}`);

        if (!resp.ok) {
            throw new Error(`Server returned ${resp.status} ${resp.statusText}`);
        }

        const result = await resp.json();
        log("Data received. Success: " + result.success);

        if (result.success) {
            currentData = result.data;
            renderLists(currentData);
            const now = new Date().toLocaleString();
            if (statusBar) statusBar.textContent = `Data Last Updated: ${now}`;
        } else {
            const err = result.error || 'Unknown Error';
            log("Error in data: " + err);
            if (amazonList) amazonList.innerHTML = `<div style="padding:20px; text-align:center; color:red;">Error: ${err}</div>`;
            if (noonList) noonList.innerHTML = `<div style="padding:20px; text-align:center; color:red;">Error: ${err}</div>`;
        }
    } catch (err) {
        console.error(err);
        log("Fetch Error: " + err.message);
        const msg = err.message.includes('Failed to fetch')
            ? 'Connection Failed. Ensure Server is Running.'
            : `Client Error: ${err.message}`;

        if (amazonList) amazonList.innerHTML = `<div style="padding:20px; text-align:center; color:red;">${msg}</div>`;
        if (noonList) noonList.innerHTML = `<div style="padding:20px; text-align:center; color:red;">${msg}</div>`;
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

function renderLists(data) {
    function createItemHTML(item, index) {
        return `
            <a href="${item.product_url}" target="_blank" class="product-item link-btn">
                <div class="product-rank">#${index + 1}</div>
                <!-- Image Removed as per user request -->
                <div class="product-info">
                    <div class="product-title" title="${item.name}">${item.name}</div>
                    <div class="product-meta">${item.brand || 'Generic'} • ${item.condition}</div>
                    <!-- Price Removed -->
                    <div class="product-rating">
                        <span>★ ${item.rating || 'N/A'}</span>
                        <span style="color:#9ca3af; font-size:0.75rem;">(${item.reviews || 0})</span>
                    </div>
                    ${item.recent_sales ? `<div class="product-sales" style="color:#ec4899; font-size:0.75rem; font-weight:bold; margin-top:4px;">🔥 ${item.recent_sales} bought recently</div>` : ''}
                </div>
            </a>
        `;
    }

    if (data.amazon && data.amazon.length > 0) {
        if (amazonList) amazonList.innerHTML = data.amazon.map((item, i) => createItemHTML(item, i)).join('');
    } else {
        if (amazonList) amazonList.innerHTML = '<div style="padding:20px; text-align:center;">No items found.</div>';
    }

    if (data.noon && data.noon.length > 0) {
        if (noonList) noonList.innerHTML = data.noon.map((item, i) => createItemHTML(item, i)).join('');
    } else {
        if (noonList) noonList.innerHTML = '<div style="padding:20px; text-align:center;">No items found.</div>';
    }
}

if (downloadBtn) {
    downloadBtn.addEventListener('click', async () => {
        if (currentData.amazon.length === 0 && currentData.noon.length === 0) {
            alert("No data to download. Fetch first.");
            return;
        }

        const header = ['Rank', 'Platform', 'Name', 'Brand', 'Price', 'Currency', 'Condition', 'Rating', 'Reviews', 'URL', 'Last Updated'];
        const rows = [];

        currentData.amazon.forEach((item, i) => {
            rows.push([i + 1, 'Amazon', item.name, item.brand, item.price, item.currency, item.condition, item.rating, item.reviews, item.product_url, item.last_updated]);
        });
        currentData.noon.forEach((item, i) => {
            rows.push([i + 1, 'Noon', item.name, item.brand, item.price, item.currency, item.condition, item.rating, item.reviews, item.product_url, item.last_updated]);
        });

        const csvContent = [
            header.join(','),
            ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `market_trends_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}
