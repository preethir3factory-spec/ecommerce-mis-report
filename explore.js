// Global State
let fullOrders = [];
let currentFilteredOrders = [];

document.addEventListener('DOMContentLoaded', () => {
    // Buttons
    const filterBtns = document.querySelectorAll('.filter-btn[data-range]');
    const customApply = document.getElementById('custom-apply-btn');
    const downloadBtn = document.getElementById('download-csv-btn');

    // Load Data
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['misData'], (result) => {
            if (result.misData) {
                fullOrders = result.misData.detailedOrders || [];
                document.getElementById('data-status').textContent = `Last Updated: ${formatDate(result.misData.lastUpdated)}`;

                // Initial Render (All Time)
                applyFilter('all');
            } else {
                document.getElementById('data-status').textContent = 'No Data Found.';
            }
        });
    } else {
        document.getElementById('data-status').textContent = 'Dev Mode (No Chrome Storage)';
    }

    // Filter Listeners
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // UI Toggle
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Logic
            applyFilter(btn.getAttribute('data-range'));
        });
    });

    // Custom Date Listener
    customApply.addEventListener('click', () => {
        applyFilter('custom');
    });

    // Download Listener
    downloadBtn.addEventListener('click', downloadCSV);
});

// Filter Logic matches user request (Today, Yesterday, 30, 365)
function applyFilter(range) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Yesterday
    const yest = new Date(now);
    yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toISOString().split('T')[0];

    let filtered = [];

    if (range === 'all') {
        filtered = fullOrders;
    }
    else if (range === 'today') {
        filtered = fullOrders.filter(o => o.date && o.date.startsWith(todayStr));
    }
    else if (range === 'yesterday') {
        filtered = fullOrders.filter(o => o.date && o.date.startsWith(yestStr));
    }
    else if (range === '30days') {
        const threshold = new Date(now);
        threshold.setDate(threshold.getDate() - 30);
        filtered = fullOrders.filter(o => new Date(o.date) >= threshold);
    }
    else if (range === '365days') {
        const threshold = new Date(now);
        threshold.setDate(threshold.getDate() - 365);
        filtered = fullOrders.filter(o => new Date(o.date) >= threshold);
    }
    else if (range === 'custom') {
        const start = document.getElementById('start-date').value;
        const end = document.getElementById('end-date').value;
        if (!start || !end) {
            alert("Please select Start and End dates.");
            return;
        }
        filtered = fullOrders.filter(o => {
            const d = o.date.split('T')[0];
            return d >= start && d <= end;
        });
    }

    currentFilteredOrders = filtered;
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

    [...orders].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 50).forEach(o => {
        const isEst = (o.feeType && o.feeType.includes('Est'));
        const typeLabel = o.feeType || 'Estimated';
        const typeColor = isEst ? '#f59e0b' : '#10b981'; // Orange vs Green

        const isRefund = o.amount < 0;
        const salesDisplay = isRefund ? '-' : formatCurrency(o.amount);
        const refundDisplay = isRefund ? formatCurrency(Math.abs(o.amount)) : '-';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${o.date ? o.date.split('T')[0] : ''}</td>
            <td>${o.id}</td>
            <td>${o.status}</td>
            <td>${salesDisplay}</td>
            <td style="color: #ef4444;">${refundDisplay}</td>
            <td style="color: #ef4444;">-${formatCurrency(o.fees)}</td>
        `;
        tbody.appendChild(tr);
    });
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
    const headers = ["Date", "Platform", "Order ID", "Status", "Amount", "Fees", "Cost", "Currency", "Fee Type"];

    // Rows
    const rows = currentFilteredOrders.map(o => [
        o.date ? o.date.split('T')[0] : '',
        o.platform,
        o.id,
        o.status,
        o.amount,
        o.fees,
        o.cost,
        o.currency || 'AED',
        o.feeType || 'Estimated'
    ]);

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
