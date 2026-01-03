let currentMode = 'retail';
let allData = [];

document.addEventListener('DOMContentLoaded', () => {
    fetchRetailData();

    document.getElementById('refresh-btn').addEventListener('click', () => {
        fetchRetailData();
    });

    document.getElementById('search-input').addEventListener('input', handleSearch);
});

async function fetchRetailData() {
    setupTable('retail');
    const tableBody = document.getElementById('odoo-table-body');
    const countLabel = document.getElementById('record-count');

    tableBody.innerHTML = '<tr><td colspan="7" class="loading">Fetching Stock in Retail Location...</td></tr>';
    countLabel.textContent = 'Fetching...';

    try {
        const res = await fetch('http://localhost:3000/api/odoo/retail-stock');
        const json = await res.json();

        if (json.success) {
            allData = json.data;
            renderTable(allData);
            countLabel.textContent = `${allData.length} records found`;
        } else {
            tableBody.innerHTML = `<tr><td colspan="7" class="error">Error: ${json.error}</td></tr>`;
        }
    } catch (err) {
        console.error(err);
        tableBody.innerHTML = `<tr><td colspan="7" class="error">Connection Error.</td></tr>`;
    }
}

function setupTable(mode) {
    const thead = document.querySelector('thead tr');
    // Always Retail Mode headers
    thead.innerHTML = `
        <th>SKU / Ref</th>
        <th>Product Name</th>
        <th>Stock</th>
        <th>Location</th>
        <th>Lot / Serial</th>
        <th>Parent Location</th>
    `;
}

function renderTable(data) {
    const tableBody = document.getElementById('odoo-table-body');
    tableBody.innerHTML = '';

    if (data.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="loading">No records found</td></tr>`;
        return;
    }

    data.forEach(item => {
        const row = document.createElement('tr');

        // Always Retail Mode Row
        row.innerHTML = `
            <td style="font-weight:500;">${item.sku || '-'}</td>
            <td>${item.name}</td>
            <td><span class="stock-badge stock-high">${item.qty}</span></td>
            <td>${item.location}</td>
            <td style="font-family:monospace;">${item.lot || '-'}</td>
            <td style="color:#6b7280;">Retail Location</td> 
        `;
        tableBody.appendChild(row);
    });
}

function handleSearch(e) {
    const term = e.target.value.toLowerCase();
    const filtered = allData.filter(p => {
        // Always Retail Search
        return (p.name && p.name.toLowerCase().includes(term)) ||
            (p.sku && p.sku.toLowerCase().includes(term)) ||
            (p.lot && p.lot.toLowerCase().includes(term)) ||
            (p.location && p.location.toLowerCase().includes(term));
    });

    renderTable(filtered);
    document.getElementById('record-count').textContent = `${filtered.length} records found`;
}

function formatCurrency(val) {
    if (!val) return 'AED 0.00';
    return 'AED ' + parseFloat(val).toFixed(2);
}
