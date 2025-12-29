document.addEventListener('DOMContentLoaded', () => {
    fetchOdooData();

    document.getElementById('refresh-btn').addEventListener('click', fetchOdooData);
    document.getElementById('search-input').addEventListener('input', handleSearch);
});

let allProducts = [];

async function fetchOdooData() {
    const tableBody = document.getElementById('odoo-table-body');
    const countLabel = document.getElementById('record-count');

    tableBody.innerHTML = '<tr><td colspan="6" class="loading">Loading data from Odoo ERP...</td></tr>';
    countLabel.textContent = 'Fetching...';

    try {
        // Fetch from our local server proxy
        const res = await fetch('http://localhost:3000/api/odoo/products?limit=100');
        const json = await res.json();

        if (json.success) {
            allProducts = json.data;
            renderTable(allProducts);
            countLabel.textContent = `${allProducts.length} records found`;
        } else {
            tableBody.innerHTML = `<tr><td colspan="6" class="error">Error: ${json.error}</td></tr>`;
        }
    } catch (err) {
        console.error(err);
        tableBody.innerHTML = `<tr><td colspan="6" class="error">Connection Error. Ensure Server is running.</td></tr>`;
        countLabel.textContent = 'Error';
    }
}

function renderTable(products) {
    const tableBody = document.getElementById('odoo-table-body');
    tableBody.innerHTML = '';

    if (products.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="6" class="loading">No products found</td></tr>';
        return;
    }

    products.forEach(p => {
        const row = document.createElement('tr');

        let stockClass = 'stock-med';
        if (p.stock > 10) stockClass = 'stock-high';
        if (p.stock <= 0) stockClass = 'stock-low';

        row.innerHTML = `
            <td style="font-weight:500;">${p.sku || '-'}</td>
            <td>${p.name}</td>
            <td style="color:#6b7280; font-size:0.9em;">${p.category || '-'}</td>
            <td class="cost-col">${formatCurrency(p.cost)}</td>
            <td><span class="stock-badge ${stockClass}">${p.stock}</span></td>
            <td style="font-family:monospace; color:#6b7280; font-size:0.85em;">${p.barcode || ''}</td>
        `;
        tableBody.appendChild(row);
    });
}

function handleSearch(e) {
    const term = e.target.value.toLowerCase();
    const filtered = allProducts.filter(p =>
        (p.name && p.name.toLowerCase().includes(term)) ||
        (p.sku && p.sku.toLowerCase().includes(term)) ||
        (p.barcode && p.barcode.toLowerCase().includes(term))
    );
    renderTable(filtered);
    document.getElementById('record-count').textContent = `${filtered.length} records found`;
}

function formatCurrency(val) {
    if (!val) return 'AED 0.00';
    return 'AED ' + parseFloat(val).toFixed(2);
}
