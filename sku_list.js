document.addEventListener('DOMContentLoaded', () => {
    // 1. Navigation
    document.getElementById('backBtn').addEventListener('click', () => {
        window.location.href = 'explore.html';
    });

    document.getElementById('refreshBtn').addEventListener('click', fetchSkuList);

    // 2. Fetch Logic
    fetchSkuList();

    // 3. Search & Filter & Pagination Listeners
    document.getElementById('searchInput').addEventListener('input', filterList);
    document.getElementById('platformFilter').addEventListener('change', filterList);
    document.getElementById('stockFilter').addEventListener('change', filterList);

    document.getElementById('prevPageBtn').addEventListener('click', () => changePage(-1));
    document.getElementById('nextPageBtn').addEventListener('click', () => changePage(1));
});

let allSkus = [];
let filteredSkus = []; // Store currently filtered list
let currentPage = 1;
const pageSize = 20;

async function fetchSkuList() {
    const tableBody = document.querySelector('#skuTable tbody');
    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">Fetching Live Inventory...</td></tr>';

    try {
        const settings = await getSettings();
        const serverUrl = 'http://localhost:3000'; // Default

        // Create a minimal payload with only needed credentials
        const payload = {
            refreshToken: settings.refreshToken || settings.amazonToken, // Handle both key names
            clientId: settings.clientId,
            clientSecret: settings.clientSecret,
            marketplaceId: settings.marketplaceId,
            noonKey: settings.noonKey || settings.noon_key,
            noonToken: settings.noonToken || settings.noon_private_key
        };

        // We will call the Live Inventory Endpoint (Amazon APIs + Noon APIs)
        const response = await fetch(`${serverUrl}/api/fetch-live-inventory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error("Failed to fetch products");

        const result = await response.json();

        if (result.success && result.data) {
            allSkus = result.data.map(item => ({
                sku: item.sku || 'N/A',
                name: item.name || 'Unknown Product',
                category: item.category || 'Uncategorized',
                qty: item.qty || 0,
                platform: item.platform || 'Unknown',
                status: (item.qty > 0) ? 'Active' : 'Out of Stock' // Normalize status
            }));

            // Filter out items with no SKU
            allSkus = allSkus.filter(s => s.sku !== 'N/A');

            // Initial Filter & Render
            filterList();

        } else {
            throw new Error("Invalid data format from server");
        }

    } catch (err) {
        console.error(err);
        tableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red; padding: 20px;">Error Loading SKUs: ${err.message}.<br>Ensure Server is Running.</td></tr>`;
    }
}

function filterList() {
    const query = document.getElementById('searchInput').value.toLowerCase();
    const platform = document.getElementById('platformFilter').value;
    const stock = document.getElementById('stockFilter').value;

    filteredSkus = allSkus.filter(item => {
        const matchesSearch = item.sku.toLowerCase().includes(query) || item.name.toLowerCase().includes(query);
        const matchesPlatform = platform === 'all' || item.platform.toLowerCase().includes(platform);

        let matchesStock = true;
        if (stock === 'active') {
            matchesStock = item.qty > 0;
        } else if (stock === 'nostock') {
            matchesStock = item.qty <= 0;
        }

        return matchesSearch && matchesPlatform && matchesStock;
    });

    // Reset to page 1 on new filter
    currentPage = 1;
    renderPagination();
}

function changePage(direction) {
    const totalPages = Math.ceil(filteredSkus.length / pageSize);
    let newPage = currentPage + direction;
    if (newPage >= 1 && newPage <= totalPages) {
        currentPage = newPage;
        renderPagination();
    }
}

function renderPagination() {
    const tableBody = document.querySelector('#skuTable tbody');
    const totalItems = filteredSkus.length;
    const totalPages = Math.ceil(totalItems / pageSize) || 1;

    // Safety Check
    if (currentPage > totalPages) currentPage = 1;

    // Update Controls
    document.getElementById('pageIndicator').innerText = `Page ${currentPage} of ${totalPages} (${totalItems} items)`;
    document.getElementById('prevPageBtn').disabled = currentPage === 1;
    document.getElementById('nextPageBtn').disabled = currentPage === totalPages;

    if (totalItems === 0) {
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">No SKUs matching filters.</td></tr>';
        return;
    }

    // Slice Data
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageData = filteredSkus.slice(startIndex, endIndex);

    // Render Table
    tableBody.innerHTML = '';
    pageData.forEach(item => {
        const row = document.createElement('tr');

        let platformBadge = `<span style="padding:2px 6px; border-radius:4px; font-size:0.75rem; font-weight:bold; ${item.platform.includes('Amazon') ? 'background:#FF9900; color:white;' : 'background:#FEEE00; color:black;'}">${item.platform}</span>`;
        if (item.platform === 'Amazon/Noon') platformBadge = `<span style="background:#ddd; padding:2px 6px; border-radius:4px; font-size:0.75rem;">Mixed</span>`;

        let statusClass = item.qty > 0 ? 'status-active' : 'status-low';
        // Force Active/Out of Stock text based on quantity logic
        let statusText = item.qty > 0 ? 'Active' : 'Out of Stock';

        row.innerHTML = `
            <td>${platformBadge}</td>
            <td class="sku">${item.sku}</td>
            <td>${item.name}</td>
            <td>${item.category}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        `;
        tableBody.appendChild(row);
    });
}

function getSettings() {
    return new Promise(resolve => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get(null, resolve);
        } else {
            resolve({});
        }
    });
}
