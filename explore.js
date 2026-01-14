// Global State
let fullOrders = [];
let currentFilteredOrders = [];
let currentPage = 1;
const itemsPerPage = 50;
let currentRange = 'all';
let currentPlatform = 'all';

document.addEventListener('DOMContentLoaded', () => {
    // Buttons
    const filterBtns = document.querySelectorAll('.filter-btn[data-range]');
    const platformSelect = document.getElementById('platform-filter');
    const customApply = document.getElementById('custom-apply-btn');
    const downloadBtn = document.getElementById('download-csv-btn');

    // Load Data
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['misData'], (result) => {
            if (result.misData) {
                fullOrders = result.misData.detailedOrders || [];
                document.getElementById('data-status').textContent = `Last Updated: ${formatDate(result.misData.lastUpdated)}`;

                // Initial Render (All Time)
                applyFilters();
            } else {
                document.getElementById('data-status').textContent = 'No Data Found.';
            }
        });
    } else {
        document.getElementById('data-status').textContent = 'Dev Mode (No Chrome Storage)';
    }

    // Filter Listeners (Date)
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // UI Toggle
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Logic
            currentRange = btn.getAttribute('data-range');
            applyFilters();
        });
    });

    // Platform Listener
    if (platformSelect) {
        platformSelect.addEventListener('change', () => {
            currentPlatform = platformSelect.value;
            applyFilters();
        });
    }

    // Custom Date Listener
    customApply.addEventListener('click', () => {
        currentRange = 'custom';
        applyFilters();
    });

    // Download Listener
    downloadBtn.addEventListener('click', downloadCSV);

    // Pagination Listeners
    document.getElementById('prev-page-btn').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable(currentFilteredOrders);
        }
    });

    document.getElementById('next-page-btn').addEventListener('click', () => {
        const totalPages = Math.ceil(currentFilteredOrders.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderTable(currentFilteredOrders);
        }
    });
});

// Unified Filter Logic
function applyFilters() {
    const now = new Date();

    // Normalize "Today" to Local 00:00:00
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    // Normalize "Yesterday" to Local 00:00:00
    const yestStart = new Date(todayStart);
    yestStart.setDate(yestStart.getDate() - 1);
    const yestEnd = new Date(yestStart);
    yestEnd.setHours(23, 59, 59, 999);

    let filtered = fullOrders;

    // 1. Date Filter
    if (currentRange === 'today') {
        filtered = filtered.filter(o => {
            if (!o.date) return false;
            const d = new Date(o.date);
            return d >= todayStart && d <= todayEnd;
        });
    }
    else if (currentRange === 'yesterday') {
        filtered = filtered.filter(o => {
            if (!o.date) return false;
            const d = new Date(o.date);
            return d >= yestStart && d <= yestEnd;
        });
    }
    else if (currentRange === '30days') {
        const threshold = new Date(now);
        threshold.setDate(threshold.getDate() - 30);
        threshold.setHours(0, 0, 0, 0);
        const endRange = new Date(now);
        endRange.setHours(23, 59, 59, 999);

        filtered = filtered.filter(o => {
            if (!o.date) return false;
            const d = new Date(o.date);
            return d >= threshold && d <= endRange;
        });
    }
    else if (currentRange === '365days') {
        const threshold = new Date(now);
        threshold.setFullYear(threshold.getFullYear() - 1); // Use FullYear to match Popup
        threshold.setHours(0, 0, 0, 0); // Include full start day
        const endRange = new Date(now);
        endRange.setHours(23, 59, 59, 999);

        filtered = filtered.filter(o => {
            if (!o.date) return false;
            const d = new Date(o.date);
            return d >= threshold && d <= endRange;
        });
    }
    else if (currentRange === 'custom') {
        const startVal = document.getElementById('start-date').value;
        const endVal = document.getElementById('end-date').value;
        if (!startVal || !endVal) {
            alert("Please select Start and End dates.");
            return;
        }
        // Input is YYYY-MM-DD
        const start = new Date(startVal); start.setHours(0, 0, 0, 0);
        const end = new Date(endVal); end.setHours(23, 59, 59, 999);

        filtered = filtered.filter(o => {
            const d = new Date(o.date);
            return d >= start && d <= end;
        });
    }

    // 2. Platform Filter
    if (currentPlatform !== 'all') {
        filtered = filtered.filter(o => (o.platform || 'Amazon') === currentPlatform);
    }

    currentFilteredOrders = filtered;
    currentPage = 1; // Reset to first page on filter change
    renderDashboard(filtered);
}

function renderDashboard(orders) {
    // Recalculate everything based on 'orders' subset
    let totalSales = 0, totalMargin = 0, amazonSales = 0, noonSales = 0;

    // Aggregation by Date
    const dailyData = {}; // 'YYYY-MM-DD': { sales: 0, fees: 0, returns: 0 }

    orders.forEach(o => {
        const amt = parseFloat(o.amount) || 0;
        const fees = parseFloat(o.fees) || 0;
        const cost = parseFloat(o.cost) || 0;

        // Metrics
        totalSales += amt;
        totalMargin += (amt - fees - cost);
        if (o.platform === 'Amazon') amazonSales += amt;
        if (o.platform === 'Noon') noonSales += amt;

        // Daily Grouping
        let d = o.date ? o.date.split('T')[0] : 'Unknown';
        if (!dailyData[d]) dailyData[d] = { sales: 0, fees: 0, returns: 0 };

        dailyData[d].sales += amt;
        dailyData[d].fees += fees;

        // Infer Returns from Status
        if (o.status && (o.status.toLowerCase().includes('return') || o.status.toLowerCase().includes('refund'))) {
            dailyData[d].returns += Math.abs(amt);
        }
    });

    // Update Cards
    document.getElementById('total-sales').textContent = formatCurrency(totalSales);
    document.getElementById('total-margin').textContent = formatCurrency(totalMargin);
    const limit = totalSales > 0 ? totalSales : 1;
    document.getElementById('amazon-share').textContent = ((amazonSales / limit) * 100).toFixed(1) + '%';
    document.getElementById('noon-share').textContent = ((noonSales / limit) * 100).toFixed(1) + '%';

    // Chart Data Preparation
    const sortedDates = Object.keys(dailyData).sort();
    const chartPoints = sortedDates.map(d => ({
        date: d,
        sales: dailyData[d].sales,
        fees: dailyData[d].fees,
        returns: dailyData[d].returns
    }));

    drawInteractiveChart(document.getElementById('salesChart'), chartPoints);

    // Render Table
    renderTable(orders);
}

function renderTable(orders) {
    const tbody = document.getElementById('orders-table-body');
    tbody.innerHTML = '';

    // Sort
    const sortedOrders = [...orders].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Pagination Slicing
    const totalItems = sortedOrders.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

    // Safety check
    if (currentPage > totalPages) currentPage = totalPages;
    if (currentPage < 1) currentPage = 1;

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageOrders = sortedOrders.slice(start, end);

    pageOrders.forEach(o => {
        const isEst = (o.feeType && o.feeType.includes('Est'));

        // Calc Margin
        const sale = parseFloat(o.amount) || 0;
        const fee = parseFloat(o.fees) || 0;
        const cost = parseFloat(o.cost) || 0;
        const margin = sale - fee - cost;
        const marginPercent = sale > 0 ? (margin / sale * 100).toFixed(1) : 0;

        const tr = document.createElement('tr');
        tr.innerHTML = `
                <td>${o.date ? o.date.split('T')[0] : ''}</td>
                <td><span style="font-size:0.85em; font-weight:500;">${o.id}</span></td>
                <td>${o.platform || 'Amazon'}</td>
                <td>${formatCurrency(sale)}</td>
                <td style="color:#ef4444">${formatCurrency(fee)}</td>
                <td style="color:#6b7280">${cost > 0 ? formatCurrency(cost) : '-'}</td>
                <td style="font-weight:600; color: ${margin > 0 ? '#10b981' : '#ef4444'}">
                    ${formatCurrency(margin)} <span style="font-size:0.8em">(${marginPercent}%)</span>
                </td>
                <td style="font-size:0.85em; color:#4b5563;">
                    ${o.invoiceRef || '-'} 
                    ${o.invoiceStatus ? `<br><span style="font-size:0.75em; color:${o.invoiceStatus === 'paid' ? '#10b981' : '#f59e0b'}">${o.invoiceStatus}</span>` : ''}
                </td>
            `;
        tbody.appendChild(tr);
    });

    renderPaginationControls(totalItems);
}

function renderPaginationControls(totalItems) {
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages}`;

    const prevBtn = document.getElementById('prev-page-btn');
    const nextBtn = document.getElementById('next-page-btn');

    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
        // Style disabled state
        prevBtn.style.opacity = prevBtn.disabled ? '0.5' : '1';
        prevBtn.style.cursor = prevBtn.disabled ? 'not-allowed' : 'pointer';
    }

    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.opacity = nextBtn.disabled ? '0.5' : '1';
        nextBtn.style.cursor = nextBtn.disabled ? 'not-allowed' : 'pointer';
    }
}

function formatCurrency(num) {
    return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(num);
}
function formatDate(iso) { return iso ? new Date(iso).toLocaleString() : 'Never'; }

// --- Interactive Chart Logic ---
let chartInstance = null; // Store state if needed

function drawInteractiveChart(canvas, data) {
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;

    // Create Tooltip Element if doesn't exist
    let tooltip = document.getElementById('chart-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'chart-tooltip';
        tooltip.style.cssText = `
            position: absolute; display: none; background: rgba(30, 41, 59, 0.95); 
            color: white; padding: 10px; border-radius: 6px; pointer-events: none; 
            font-size: 0.8rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border: 1px solid #475569; z-index:10;
        `;
        container.appendChild(tooltip); // Append to chart container (needs position: relative)
    }

    // Resize
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
    const cw = canvas.width;
    const ch = canvas.height;
    const padding = 40;

    // Scales
    const maxSales = Math.max(...data.map(d => d.sales), 1) * 1.1;
    const xStep = (cw - padding * 2) / (data.length > 1 ? data.length - 1 : 1);

    function getY(val) { return ch - padding - (val / maxSales) * (ch - padding * 2); }
    function getX(i) { return padding + i * xStep; }

    // Draw Function
    function draw() {
        ctx.clearRect(0, 0, cw, ch);

        if (data.length === 0) {
            ctx.fillText("No Data", cw / 2, ch / 2); return;
        }

        // Axes
        ctx.strokeStyle = '#475569'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding); ctx.lineTo(padding, ch - padding); ctx.lineTo(cw - padding, ch - padding);
        ctx.stroke();

        // Line
        ctx.beginPath();
        ctx.strokeStyle = '#43B02A'; ctx.lineWidth = 2; // Brand Green
        data.forEach((p, i) => {
            if (i === 0) ctx.moveTo(getX(i), getY(p.sales));
            else ctx.lineTo(getX(i), getY(p.sales));
        });
        ctx.stroke();

        // Fill
        ctx.lineTo(getX(data.length - 1), ch - padding);
        ctx.lineTo(padding, ch - padding);
        ctx.fillStyle = 'rgba(67, 176, 42, 0.1)'; // Brand Green Transparent
        ctx.fill();

        // Labels
        ctx.fillStyle = '#9ca3af'; ctx.textAlign = "center";
        const skip = Math.ceil(data.length / 8);
        data.forEach((p, i) => {
            if (i % skip === 0) ctx.fillText(p.date.slice(5), getX(i), ch - padding + 15);
        });
    }

    draw();

    // Interaction
    canvas.onmousemove = (e) => {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;

        // Find closest index
        // mx = padding + i * xStep => i = (mx - padding) / xStep
        let idx = Math.round((mx - padding) / xStep);
        if (idx < 0) idx = 0;
        if (idx >= data.length) idx = data.length - 1;

        const point = data[idx];
        const px = getX(idx);
        const py = getY(point.sales);

        // Check if mouse is near x (optional constraint)
        if (Math.abs(mx - px) < xStep / 1.5) {
            // Highlight Line
            draw(); // Clear & Redraw
            ctx.beginPath();
            ctx.moveTo(px, padding); ctx.lineTo(px, ch - padding);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 1;
            ctx.stroke();

            // Highlight Dot
            ctx.beginPath();
            ctx.arc(px, py, 4, 0, Math.PI * 2);
            ctx.fillStyle = 'white'; ctx.fill();
            ctx.strokeStyle = '#43B02A'; ctx.lineWidth = 2; ctx.stroke();

            // Show Tooltip
            tooltip.style.display = 'block';
            tooltip.style.left = (px + 10) + 'px'; // Relative to container
            tooltip.style.top = (py - 10) + 'px';
            tooltip.innerHTML = `
                <div style="font-weight:bold; margin-bottom:4px;">${point.date}</div>
                <div>Sales: ${formatCurrency(point.sales)}</div>
                <div>Fees: ${formatCurrency(point.fees)}</div>
                <div style="color:#ef4444">Returns: ${formatCurrency(point.returns)}</div>
            `;
            // Keep tooltip inside bounds
            if (px > cw - 150) tooltip.style.left = (px - 160) + 'px';

        } else {
            draw();
            tooltip.style.display = 'none';
        }
    };

    canvas.onmouseleave = () => {
        draw();
        tooltip.style.display = 'none';
    };
}

function downloadCSV() {
    if (!currentFilteredOrders || currentFilteredOrders.length === 0) {
        alert("No data to download.");
        return;
    }

    // Header
    const headers = ["Date", "Platform", "Order ID", "Status", "SKU (Noon Only)", "Amount", "Fees", "Cost (Odoo)", "Margin", "Margin %", "Fee Type", "Odoo Invoice", "Inv Status"];

    // Rows
    const rows = currentFilteredOrders.map(o => {
        const sale = parseFloat(o.amount) || 0;
        const fee = parseFloat(o.fees) || 0;
        const cost = parseFloat(o.cost) || 0;
        const margin = sale - fee - cost;
        const marginP = sale > 0 ? (margin / sale * 100).toFixed(2) : 0;

        return [
            o.date ? o.date.split('T')[0] : '',
            o.platform || 'Amazon',
            o.id,
            o.status,
            o.skus || '',
            sale.toFixed(2),
            fee.toFixed(2),
            cost.toFixed(2),
            margin.toFixed(2),
            marginP + '%',
            o.feeType || 'Estimated',
            o.invoiceRef || '',
            o.invoiceStatus || ''
        ];
    });

    // Construct CSV String
    const csvContent = [
        headers.join(','),
        ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `mis_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
