document.addEventListener('DOMContentLoaded', () => {
    // Default Data (Clean State)
    const defaultStructure = { sales: 0.00, cost: 0.00, fees: 0.00, returns: 0.00, sold: 0, liveSkus: 0, totalSkus: 0, weekly: [0, 0, 0, 0, 0, 0, 0] };
    const defaultData = {
        today: { amazon: { ...defaultStructure }, noon: { ...defaultStructure } },
        yesterday: { amazon: { ...defaultStructure }, noon: { ...defaultStructure } },
        all: { amazon: { ...defaultStructure }, noon: { ...defaultStructure } },
        detailedOrders: [], // Store list of {id, date, platform, amount, status}
        lastUpdated: null
    };

    // State
    let rawData = JSON.parse(JSON.stringify(defaultData));
    let currentDate = 'today';
    let currentPlatform = 'all';

    // UI Elements
    const salesEl = document.getElementById('sales-value');
    const costEl = document.getElementById('cost-value');
    const feesEl = document.getElementById('fees-value'); // New
    const marginValEl = document.getElementById('margin-value');
    const marginBar = document.getElementById('margin-bar');
    const marginPercentEl = document.getElementById('margin-percent');
    const soldEl = document.getElementById('sold-count');
    const listedEl = document.getElementById('listed-count');
    const chartContainer = document.getElementById('weekly-chart');

    const tabs = document.querySelectorAll('.tab');
    const dateBtns = document.querySelectorAll('.date-btn');
    const downloadBtn = document.getElementById('download-btn');
    const resetBtn = document.getElementById('resetBtn');

    // --- Persistence Logic ---
    function loadData() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.get(['misData'], function (result) {
                if (result.misData) {
                    rawData = result.misData;
                }
                deepSanitize();
                renderView();
            });
        } else {
            deepSanitize(); // even for default
            renderView();
        }
    }

    function deepSanitize() {
        if (!rawData || typeof rawData !== 'object') {
            rawData = JSON.parse(JSON.stringify(defaultData));
            return;
        }

        ['today', 'yesterday', 'all'].forEach(d => {
            // Re-use Today's structure as fallback if missing
            if (!rawData[d]) rawData[d] = JSON.parse(JSON.stringify(defaultData.today));

            ['amazon', 'noon'].forEach(p => {
                if (!rawData[d][p]) rawData[d][p] = JSON.parse(JSON.stringify(defaultData[d][p]));

                const rec = rawData[d][p];
                // Ensure numeric fields
                ['sales', 'cost', 'fees', 'returns'].forEach(f => {
                    if (typeof rec[f] !== 'number') rec[f] = 0;
                });
                ['sold', 'liveSkus', 'totalSkus'].forEach(f => {
                    if (typeof rec[f] !== 'number') rec[f] = 0;
                });

                // Ensure weekly array
                if (!rec.weekly || !Array.isArray(rec.weekly) || rec.weekly.length !== 7) {
                    rec.weekly = [0, 0, 0, 0, 0, 0, 0];
                }
            });
        });

        // Ensure detailedOrders exists
        if (!rawData.detailedOrders || !Array.isArray(rawData.detailedOrders)) {
            rawData.detailedOrders = [];
        }

        if (rawData.lastUpdated === undefined) rawData.lastUpdated = null;
    }

    function saveData() {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({ misData: rawData });
        }
    }

    function resetData() {
        if (confirm('Are you sure you want to reset all data to default? This cannot be undone.')) {
            rawData = JSON.parse(JSON.stringify(defaultData));
            saveData();
            renderView();
        }
    }

    function formatCurrency(num) {
        return new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED' }).format(num);
    }

    // Robust CSV Line Parser
    function parseCSVLine(text) {
        // Detect Delimiter
        const semiCount = (text.match(/;/g) || []).length;
        const commaCount = (text.match(/,/g) || []).length;
        const delimiter = semiCount > commaCount ? ';' : ',';

        const res = [];
        let current = '';
        let inQuote = false;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            if (char === '"') {
                inQuote = !inQuote;
            } else if (char === delimiter && !inQuote) {
                res.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        res.push(current);
        return res.map(Field => Field.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
    }

    function renderView() {
        let stats = {
            sales: 0, cost: 0, fees: 0, returns: 0, sold: 0,
            liveSkus: 0, totalSkus: 0, weekly: []
        };

        if (currentDate === 'custom' || currentDate === 'month' || currentDate === 'all') {
            let start, end;

            if (currentDate === 'month') {
                const now = new Date();
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date();
            } else if (currentDate === 'all') {
                const now = new Date();
                start = new Date(now);
                start.setFullYear(start.getFullYear() - 1); // Last 365 Days
                end = new Date();
            } else {
                // Custom
                const startEl = document.getElementById('date-start');
                const endEl = document.getElementById('date-end');
                if (startEl && endEl && startEl.value && endEl.value) {
                    start = new Date(startEl.value);
                    end = new Date(endEl.value);
                }
            }

            // Recalculate if range exists
            if (start && end) {
                // Ensure Local Time range coverage
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);

                // FIX: Auto-swap if range is reversed (User Error Handing)
                if (start > end) {
                    console.warn(`[Filter] Detected reversed range: ${start.toLocaleDateString()} > ${end.toLocaleDateString()}. Swapping.`);
                    const temp = start; start = end; end = temp;

                    // Update UI input values to reflect the swap (String format to avoid TZ issues)
                    if (document.getElementById('date-start')) {
                        const sY = start.getFullYear();
                        const sM = String(start.getMonth() + 1).padStart(2, '0');
                        const sD = String(start.getDate()).padStart(2, '0');
                        document.getElementById('date-start').value = `${sY}-${sM}-${sD}`;
                    }
                    if (document.getElementById('date-end')) {
                        const eY = end.getFullYear();
                        const eM = String(end.getMonth() + 1).padStart(2, '0');
                        const eD = String(end.getDate()).padStart(2, '0');
                        document.getElementById('date-end').value = `${eY}-${eM}-${eD}`;
                    }
                }

                console.log(`[Filter] Range: ${start.toLocaleString()} to ${end.toLocaleString()}`);

                if (rawData.detailedOrders) {
                    rawData.detailedOrders.forEach(o => {
                        const oDate = new Date(o.date);
                        if (oDate >= start && oDate <= end) {
                            if (currentPlatform === 'all' || o.platform.toLowerCase() === currentPlatform) {
                                // Unified Logic to match Dashboard
                                stats.sales += o.amount;
                                stats.fees += (o.fees || 0);
                                stats.cost += (o.cost || 0);

                                if (o.amount >= 0) {
                                    stats.sold++;
                                } else {
                                    stats.returns += Math.abs(o.amount);
                                }
                            }
                        }
                    });
                }

            }

            // Fallback for SKUs (Use 'all' values)
            const amzAll = rawData.all.amazon || {};
            const noonAll = rawData.all.noon || {};
            stats.liveSkus = (amzAll.liveSkus || 0) + (noonAll.liveSkus || 0);
            stats.totalSkus = (amzAll.totalSkus || 0) + (noonAll.totalSkus || 0);

        } else {
            const dayData = rawData[currentDate];
            if (currentPlatform === 'all') {
                const amz = dayData.amazon;
                const noon = dayData.noon;
                stats = {
                    sales: amz.sales + noon.sales,
                    cost: amz.cost + noon.cost,
                    fees: (amz.fees || 0) + (noon.fees || 0),
                    returns: (amz.returns || 0) + (noon.returns || 0),
                    sold: amz.sold + noon.sold,
                    liveSkus: (amz.liveSkus || 0) + (noon.liveSkus || 0),
                    totalSkus: (amz.totalSkus || 0) + (noon.totalSkus || 0),
                    weekly: amz.weekly && noon.weekly ? amz.weekly.map((val, idx) => (val + noon.weekly[idx]) / 2) : []
                };
            } else {
                stats = dayData[currentPlatform];
            }
        }

        // The following block is inserted/modified based on the instruction
        let totalSales = stats.sales;
        let totalFees = stats.fees;
        let totalReturns = stats.returns;
        let totalCost = stats.cost; // Initial value from stats

        // Recalculate Total Cost accurately from Detailed Orders if available
        // because the 'bucket' data (amazonData, noonData) might not be updated with the latest costs fetched asynchronously
        if (rawData.detailedOrders && rawData.detailedOrders.length > 0) {
            let filteredOrders = rawData.detailedOrders;

            // Filter by Date
            let activeFilter = currentDate; // Use currentDate as activeFilter
            if (activeFilter !== 'all' && activeFilter !== 'custom' && activeFilter !== 'month') { // If all time, take everything
                // Simple filter check
                const now = new Date();
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                filteredOrders = filteredOrders.filter(o => {
                    const d = new Date(o.date);
                    if (activeFilter === 'today') return d >= startOfDay;

                    const yesterdayStart = new Date(startOfDay); yesterdayStart.setDate(startOfDay.getDate() - 1);
                    const yesterdayEnd = new Date(startOfDay);
                    if (activeFilter === 'yesterday') return d >= yesterdayStart && d < yesterdayEnd;

                    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
                    if (activeFilter === 'month') return d >= monthStart;

                    // Assuming 'year' filter is not explicitly defined in currentDate, but if it were, this would handle it.
                    // For now, 'all' covers a year in the original logic, so this might be redundant.
                    const yearStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 365);
                    if (activeFilter === 'year') return d >= yearStart;

                    return true;
                });
            } else if (activeFilter === 'custom' || activeFilter === 'month' || activeFilter === 'all') {
                // Re-apply the date range logic from above for detailed orders
                let start, end;
                if (activeFilter === 'month') {
                    const now = new Date();
                    start = new Date(now.getFullYear(), now.getMonth(), 1);
                    end = new Date();
                } else if (activeFilter === 'all') {
                    const now = new Date();
                    start = new Date(now);
                    start.setFullYear(start.getFullYear() - 1); // Last 365 Days
                    end = new Date();
                } else { // Custom
                    const startEl = document.getElementById('date-start');
                    const endEl = document.getElementById('date-end');
                    if (startEl && endEl && startEl.value && endEl.value) {
                        start = new Date(startEl.value);
                        end = new Date(endEl.value);
                    }
                }

                if (start && end) {
                    start.setHours(0, 0, 0, 0);
                    end.setHours(23, 59, 59, 999);
                    filteredOrders = filteredOrders.filter(o => {
                        const oDate = new Date(o.date);
                        return oDate >= start && oDate <= end;
                    });
                }
            }

            // Filter by Platform
            if (currentPlatform !== 'all') {
                filteredOrders = filteredOrders.filter(o => o.platform.toLowerCase() === currentPlatform);
            }

            // Sum Costs
            let calculatedCost = 0;
            // Also Sum Sales just in case to match
            let calculatedSales = 0;
            let calculatedFees = 0;
            let calculatedReturns = 0;

            filteredOrders.forEach(o => {
                calculatedCost += (o.cost || 0);
                calculatedSales += (o.amount || 0);
                calculatedFees += (o.fees || 0);
                if (o.amount < 0) { // Assuming negative amount means return
                    calculatedReturns += Math.abs(o.amount);
                }
            });

            // Override Bucket Cost with Detailed Cost if valid
            totalCost = calculatedCost;
            totalSales = calculatedSales;
            totalFees = calculatedFees;
            totalReturns = calculatedReturns;
        }

        const netMargin = totalSales - totalCost - totalFees - totalReturns;
        // Prevent div by zero
        const marginPercent = totalSales > 0 ? ((netMargin / totalSales) * 100).toFixed(1) : 0;

        // B. Update DOM Elements
        // Helper to animate numbers
        const animateValue = (id, start, end, duration) => {
            const obj = document.getElementById(id);
            if (!obj) return;
            let startTimestamp = null;
            const step = (timestamp) => {
                if (!startTimestamp) startTimestamp = timestamp;
                const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                const val = progress * (end - start) + start;
                obj.textContent = formatCurrency(val);
                if (progress < 1) {
                    window.requestAnimationFrame(step);
                }
            };
            window.requestAnimationFrame(step);
        };

        // Static updates (no animation for now to be safe)
        if (salesEl) salesEl.textContent = formatCurrency(totalSales);
        if (costEl) costEl.textContent = formatCurrency(totalCost);
        if (feesEl) feesEl.textContent = formatCurrency(totalFees); // Update feesEl as well
        if (marginValEl) { // Use marginValEl instead of marginEl
            marginValEl.textContent = formatCurrency(netMargin);
            marginValEl.style.color = netMargin >= 0 ? '#10b981' : '#ef4444';
        }

        // Update Total Cost Card explicitly if ID exists
        const totalCostCardEl = document.getElementById('total-cost-amount');
        if (totalCostCardEl) totalCostCardEl.textContent = formatCurrency(totalCost);
        soldEl.textContent = stats.sold; // Keep original sold count from stats

        const returnsEl = document.getElementById('returns-value');
        const liveSkusEl = document.getElementById('live-sku-count');
        const totalSkusEl = document.getElementById('total-sku-count');

        if (returnsEl) returnsEl.textContent = formatCurrency(stats.returns || 0);
        if (liveSkusEl) liveSkusEl.textContent = stats.liveSkus || 0;
        if (totalSkusEl) totalSkusEl.textContent = stats.totalSkus || 0;

        const barWidth = Math.min(marginPercent * 2, 100);
        marginBar.style.width = `${barWidth}%`;
        marginPercentEl.textContent = `${marginPercent.toFixed(1)}% Margin`;

        renderChart(stats.weekly);

        // --- Trend Calculation (Vs Yesterday) ---
        const trendEl = document.querySelector('.card-trend');
        if (trendEl) {
            if (currentDate === 'today') {
                trendEl.style.opacity = '1';

                // Get Yesterday's Sales for comparison
                const yDayData = rawData['yesterday'];
                let ySales = 0;
                if (currentPlatform === 'all') {
                    ySales = yDayData.amazon.sales + yDayData.noon.sales;
                } else {
                    ySales = yDayData[currentPlatform].sales;
                }

                const growth = ySales > 0 ? ((stats.sales - ySales) / ySales) * 100 : 0;
                const sign = growth >= 0 ? '+' : '';

                trendEl.className = `card-trend ${growth >= 0 ? 'positive' : 'negative'}`;
                trendEl.innerHTML = `<span>${sign}${growth.toFixed(1)}%</span> vs yesterday`;
            } else {
                // Hide for 'yesterday' (no reference) or 'all' (doesn't make sense)
                trendEl.style.opacity = '0';
            }
        }


        const lastUpEl = document.getElementById('last-updated');
        if (lastUpEl) {
            if (rawData.lastUpdated) {
                lastUpEl.textContent = `Updated: ${new Date(rawData.lastUpdated).toLocaleString()}`;
            } else {
                lastUpEl.textContent = `Updated: --`;
            }
        }

        // Render Recent Orders List
        renderRecentOrders();
    }

    function renderRecentOrders() {
        const listContainer = document.getElementById('recent-orders-list');
        if (!listContainer) return;

        listContainer.innerHTML = '';

        // Get orders relevant to current filter
        let ordersToShow = [];
        if (rawData.detailedOrders) {
            // Basic sort DESC
            ordersToShow = rawData.detailedOrders.sort((a, b) => new Date(b.date) - new Date(a.date));

            // Apply Platform Filter
            if (currentPlatform !== 'all') {
                ordersToShow = ordersToShow.filter(o => o.platform.toLowerCase() === currentPlatform);
            }

            // Show top 20
            ordersToShow = ordersToShow.slice(0, 20);
        }

        if (ordersToShow.length === 0) {
            listContainer.innerHTML = '<div style="font-size:0.8rem; color:#9ca3af; text-align:center;">No recent orders found.</div>';
            return;
        }

        ordersToShow.forEach(o => {
            const card = document.createElement('div');
            card.className = 'order-card';
            card.style.cssText = 'background:white; padding:10px; border-radius:6px; border:1px solid #e5e7eb; display:flex; flex-direction:column; gap:4px; margin-bottom: 2px;';

            const costDisp = o.cost > 0 ? formatCurrency(o.cost) : '-';
            const skuDisp = o.skus ? `<div style="font-size:0.75rem; color:#4b5563; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${o.skus}">📦 ${o.skus}</div>` : '';
            const invDisp = o.invoiceRef ? `<span style="background:#f3f4f6; color:#374151; padding:2px 6px; border-radius:4px; font-size:0.7rem;">INV: ${o.invoiceRef}</span>` : '';

            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:600; font-size:0.8rem; color:#111827;">${o.id}</span>
                    <span style="font-size:0.75rem; color:${o.platform === 'Amazon' ? '#f59e0b' : '#eab308'}; font-weight:500;">${o.platform}</span>
                </div>
                ${skuDisp}
                <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-top:4px;">
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-size:0.7rem; color:#6b7280;">Sales: <b>${formatCurrency(o.amount)}</b></span>
                        <span style="font-size:0.7rem; color:#6b7280;">Cost: <b>${costDisp}</b></span>
                    </div>
                    ${invDisp}
                </div>
            `;
            listContainer.appendChild(card);
        });
    }

    function renderChart(weeklyData) {
        chartContainer.innerHTML = '';
        const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

        // Ensure data exists
        const safeData = (Array.isArray(weeklyData) && weeklyData.length === 7) ? weeklyData : [0, 0, 0, 0, 0, 0, 0];
        const maxVal = Math.max(...safeData, 50); // Avoid div by zero

        safeData.forEach((val, index) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'bar-wrapper';
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.alignItems = 'center';
            wrapper.style.width = '12%';

            const barContainer = document.createElement('div');
            barContainer.style.height = '100px';
            barContainer.style.width = '100%';
            barContainer.style.display = 'flex';
            barContainer.style.alignItems = 'flex-end';
            barContainer.style.background = '#f3f4f6';
            barContainer.style.borderRadius = '4px';
            barContainer.style.overflow = 'hidden';

            const bar = document.createElement('div');
            // bar.className = 'bar'; // Use simple inline for now to guarantee style override
            bar.style.width = '100%';
            bar.style.background = 'linear-gradient(180deg, #4f46e5 0%, #3b82f6 100%)';
            bar.style.transition = 'height 0.5s ease-out';
            bar.style.height = '0%'; // Start 0 for anim

            setTimeout(() => {
                const h = (val / maxVal) * 100;
                bar.style.height = `${h}%`;
            }, 50 * index);

            barContainer.appendChild(bar);

            const label = document.createElement('div');
            label.className = 'day-label';
            label.textContent = days[index];
            label.style.fontSize = '10px';
            label.style.marginTop = '4px';
            label.style.color = '#6b7280';

            wrapper.appendChild(barContainer);
            wrapper.appendChild(label);
            chartContainer.appendChild(wrapper);
        });
    }


    // --- Date Parsing Helper ---
    function parseDate(dateStr) {
        if (!dateStr) return new Date('Invalid');

        const cleanStr = dateStr.trim();

        // 1. Try ISO/Standard JS Parse first (Handles YYYY-MM-DD and many others commonly)
        const stdDate = new Date(cleanStr);
        if (!isNaN(stdDate.getTime()) && stdDate.getFullYear() > 2000) {
            return stdDate;
        }

        // 2. Manual Slash Parsing (DD/MM/YYYY or MM/DD/YYYY)
        if (cleanStr.includes('/')) {
            const parts = cleanStr.split('/');
            if (parts.length === 3) {
                let p0 = parseInt(parts[0], 10);
                let p1 = parseInt(parts[1], 10);
                let p2 = parseInt(parts[2], 10);

                // Handle 2-digit year (e.g., 25 -> 2025)
                if (p2 < 100) p2 += 2000;

                // Heuristic: If 2nd part > 12, it MUST be MM/DD/YYYY (e.g. 12/14/2025)
                if (p1 > 12 && p0 <= 12) {
                    return new Date(p2, p0 - 1, p1);
                }

                // Heuristic: If 1st part > 12, it MUST be DD/MM/YYYY (e.g. 14/12/2025)
                if (p0 > 12 && p1 <= 12) {
                    return new Date(p2, p1 - 1, p0);
                }

                // Ambiguous (e.g. 12/12/2025) - Default to DD/MM unless US format detected elsewhere?
                // Let's default to DD/MM/YYYY for MENA region preference, BUT
                // if we saw '12/14/25' earlier, simple JS parse often catches it.
                // If we get here with 12/12, it doesn't matter.
                return new Date(p2, p1 - 1, p0);
            }
        }

        // 3. Excel Serial Date (e.g. 45274)
        if (/^\d{5}$/.test(cleanStr)) {
            const serial = parseInt(cleanStr, 10);
            // Excel base date: Dec 30 1899
            const jsDate = new Date((serial - 25569) * 86400 * 1000);
            return jsDate;
        }

        return new Date(cleanStr);
    }

    // --- Process CSV ---
    function processCSV(csvText) {
        const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length === 0) {
            alert("File appears empty.");
            return;
        }

        // Dynamic Header Detection (Scan first 10 rows)
        let headerRowIndex = 0;
        let headers = [];
        let format = 'unknown';

        for (let i = 0; i < Math.min(lines.length, 10); i++) {
            const row = parseCSVLine(lines[i].toLowerCase());

            // Check for known signatures in this row
            if (row.some(h => h.includes('noon title') || h.includes('partner sku') || h.includes('sku_code') || h.includes('psku'))) {
                format = 'noon_detailed';
            } else if (row.some(h => h.includes('transaction') && (h.includes('amount') || h.includes('vat')))) {
                format = 'noon_financial';
            } else if (row.some(h => h.includes('order') && (h.includes('status') || h.includes('number')))) {
                format = 'noon_orders';
            } else if (row.some(h => h.includes('date/time') && h.includes('settlement id'))) {
                format = 'amazon_date_range';
            } else if (row.some(h => h.includes('date') && h.includes('ordered product sales'))) {
                format = 'amazon_business_report';
            } else if (row.some(h => h.includes('platform')) && row.some(h => h.includes('sales'))) {
                format = 'standard_fallback';
            }

            if (format !== 'unknown') {
                headerRowIndex = i;
                headers = row;
                break;
            }
        }

        if (format === 'unknown') {
            // Default to first row if scanning failed, just to show the error
            headers = parseCSVLine(lines[0].toLowerCase());
            alert('Unknown CSV Format.\n\nScanned first 10 rows but could not find matching headers.\nEnsure you have columns like: "Date", "Platform", "Sales".\n\nDetected Top Row: ' + headers.join(', '));
            return;
        }

        const todayDate = new Date();
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);

        const isSameDay = (d1, d2) => d1.toDateString() === d2.toDateString();

        let rowsProcessed = 0;
        let debugLog = `Format: ${format}\n`;

        // Stats for Feedback
        let info = {
            amazon: { count: 0, sales: 0 },
            noon: { count: 0, sales: 0 },
            skipped: 0
        };

        // Temporary storage...
        const aggregation = {
            today: { amazon: { sales: 0, cost: 0, fees: 0, returns: 0, sold: 0, liveSkus: 0, totalSkus: 0 }, noon: { sales: 0, cost: 0, fees: 0, returns: 0, sold: 0, liveSkus: 0, totalSkus: 0 } },
            yesterday: { amazon: { sales: 0, cost: 0, fees: 0, returns: 0, sold: 0, liveSkus: 0, totalSkus: 0 }, noon: { sales: 0, cost: 0, fees: 0, returns: 0, sold: 0, liveSkus: 0, totalSkus: 0 } },
            all: { amazon: { sales: 0, cost: 0, fees: 0, returns: 0, sold: 0, liveSkus: 0, totalSkus: 0 }, noon: { sales: 0, cost: 0, fees: 0, returns: 0, sold: 0, liveSkus: 0, totalSkus: 0 } }
        };

        const addToAgg = (dateStr, platform, sales, cost, fees, returns, sold, liveSkus, totalSkus) => {
            let d;
            if (format === 'noon_detailed' && (!dateStr || dateStr.length < 5)) {
                d = new Date();
            } else {
                d = parseDate(dateStr);
            }

            // Fallback for bad dates (default to today so they appear somewhere)
            if (isNaN(d.getTime())) d = new Date();

            const pKey = platform.toLowerCase().includes('noon') ? 'noon' : 'amazon';

            // Helper to add
            const updateBucket = (aggKey) => {
                if (aggregation[aggKey] && aggregation[aggKey][pKey]) {
                    const t = aggregation[aggKey][pKey];
                    t.sales += sales || 0;
                    t.cost += cost || 0;
                    t.fees += fees || 0;
                    t.returns += returns || 0;
                    t.sold += sold || 0;
                    t.liveSkus += liveSkus || 0;
                    t.totalSkus += totalSkus || 0;
                }
            };

            // Always add to 'All Time'
            updateBucket('all');

            // Date Bucketing
            if (isSameDay(d, todayDate)) {
                updateBucket('today');
            } else if (isSameDay(d, yesterdayDate)) {
                updateBucket('yesterday');
            }

            return true;
        };

        for (let i = headerRowIndex + 1; i < lines.length; i++) {
            const row = parseCSVLine(lines[i]);
            if (row.length < 2) continue;

            if (format === 'noon_detailed') {
                const possibleDate = row[0].length > 6 ? row[0] : '';
                const stockIdx = headers.findIndex(h => h.includes('stock') || h.includes('quantity') || h.includes('soh') || h.includes('available'));
                const stockVal = parseFloat(row[stockIdx]) || 0;
                const live = stockVal > 0 ? 1 : 0;
                const total = 1;
                // Fix: No sales in inventory report
                if (addToAgg(possibleDate, 'noon', 0, 0, 0, 0, 0, live, total)) rowsProcessed++;

            } else if (format === 'noon_financial') {
                const dateIdx = headers.findIndex(h => h.includes('date'));
                const amountIdx = headers.findIndex(h => h.includes('amount') || h.includes('vat inclusive'));
                const detailsIdx = headers.findIndex(h => h.includes('details') || h.includes('description') || h.includes('type'));

                if (dateIdx === -1 || amountIdx === -1) continue;

                const date = row[dateIdx];
                const rawAmount = row[amountIdx] || '0';
                const amount = parseFloat(rawAmount.replace(/[^0-9.-]+/g, "")) || 0;
                const details = row[detailsIdx] ? row[detailsIdx].toLowerCase() : '';

                if (details.includes('payout') || details.includes('withdrawal')) continue;

                let sales = 0, cost = 0, fees = 0, returns = 0;

                if (details.includes('refund') || details.includes('return')) {
                    returns = Math.abs(amount);
                } else if (amount > 0) {
                    sales = amount;
                } else if (amount < 0) {
                    if (details.includes('fee') || details.includes('commission') || details.includes('charge') || details.includes('shipping')) {
                        fees = Math.abs(amount);
                    } else {
                        cost = Math.abs(amount);
                    }
                }

                if (addToAgg(date, 'noon', sales, cost, fees, returns, 0, 0, 0)) rowsProcessed++;

            } else if (format === 'noon_orders') {
                const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('created'));
                const qtyIdx = headers.findIndex(h => h.includes('quantity') || h.includes('items'));
                const totalIdx = headers.findIndex(h => h.includes('total') || h.includes('price') || h.includes('grand total'));
                const statusIdx = headers.findIndex(h => h.includes('status'));

                const fbnFeeIdx = headers.findIndex(h => h.includes('fbn fee'));
                const fbpFeeIdx = headers.findIndex(h => h.includes('fbp fee'));
                const genericFeeIdx = headers.findIndex(h => h.includes('fee') && !h.includes('fbn') && !h.includes('fbp'));

                if (dateIdx === -1) continue;

                const date = row[dateIdx];
                const status = statusIdx > -1 ? (row[statusIdx] || '').toLowerCase() : '';

                if (status.includes('cancel')) continue;

                let sales = 0, sold = 0, returns = 0, fees = 0;
                const rawTotal = row[totalIdx] || '0';
                const rowSales = parseFloat(rawTotal.replace(/[^0-9.-]+/g, "")) || 0;

                if (fbnFeeIdx > -1) fees += Math.abs(parseFloat(row[fbnFeeIdx] || '0') || 0);
                if (fbpFeeIdx > -1) fees += Math.abs(parseFloat(row[fbpFeeIdx] || '0') || 0);
                if (genericFeeIdx > -1) fees += Math.abs(parseFloat(row[genericFeeIdx] || '0') || 0);

                // Fallback: Check if there's a column literally named 'noon fees' or 'marketplace fees' if others fail
                if (fees === 0) {
                    const marketFeeIdx = headers.findIndex(h => h.includes('marketplace fee') || h.includes('noon fee') || h.includes('commission'));
                    if (marketFeeIdx > -1) fees += Math.abs(parseFloat(row[marketFeeIdx] || '0') || 0);
                }

                if (status.includes('return')) {
                    returns = rowSales;
                } else {
                    sales = rowSales;
                    sold = parseInt(row[qtyIdx]) || 1;
                }

                if (addToAgg(date, 'noon', sales, 0, fees, returns, sold, 0, 0)) rowsProcessed++;

            } else if (format === 'amazon_date_range') {
                const dateIdx = headers.findIndex(h => h.includes('date/time'));
                const typeIdx = headers.findIndex(h => h.includes('type'));
                const salesIdx = headers.findIndex(h => h.includes('product sales'));
                const sellingFeeIdx = headers.findIndex(h => h.includes('selling fees'));
                const fbaFeeIdx = headers.findIndex(h => h.includes('fba fees'));
                const otherFeeIdx = headers.findIndex(h => h.includes('other transaction fees'));
                const totalIdx = headers.findIndex(h => h.includes('total'));
                const qtyIdx = headers.findIndex(h => h.includes('quantity'));

                if (dateIdx === -1) continue;

                const date = row[dateIdx];
                const type = row[typeIdx] ? row[typeIdx].toLowerCase() : '';

                let sales = 0, fees = 0, returns = 0, sold = 0;

                const parseVal = (idx) => idx > -1 ? (parseFloat((row[idx] || '0').replace(/[^0-9.-]+/g, "")) || 0) : 0;

                const rowSales = parseVal(salesIdx);
                const rowTotal = parseVal(totalIdx);
                const rowFees = Math.abs(parseVal(sellingFeeIdx)) + Math.abs(parseVal(fbaFeeIdx)) + Math.abs(parseVal(otherFeeIdx));

                if (type === 'order') {
                    sales = rowSales;
                    fees = rowFees;
                    sold = parseInt(row[qtyIdx]) || 1;
                } else if (type === 'refund') {
                    returns = Math.abs(rowTotal);
                } else if (type === 'service fee' || type === 'transfer') {
                    fees = Math.abs(rowTotal);
                }

                if (addToAgg(date, 'amazon', sales, 0, fees, returns, sold, 0, 0)) rowsProcessed++;

            } else if (format === 'amazon_business_report') {
                const dateIdx = headers.findIndex(h => h.includes('date'));
                const salesIdx = headers.findIndex(h => h.includes('ordered product sales'));
                const unitIdx = headers.findIndex(h => h.includes('units ordered'));

                if (dateIdx === -1) continue;

                const date = row[dateIdx];
                const sales = parseFloat((row[salesIdx] || '0').replace(/[^0-9.-]+/g, "")) || 0;
                const sold = parseInt((row[unitIdx] || '0').replace(/[^0-9.-]+/g, "")) || 0;

                if (addToAgg(date, 'amazon', sales, 0, 0, 0, sold, 0, 0)) rowsProcessed++;

            } else if (format === 'standard_fallback') {
                // Fallback Generic Parsing
                const dateIdx = headers.findIndex(h => h.includes('date'));
                const platformIdx = headers.findIndex(h => h.includes('platform'));
                const salesIdx = headers.findIndex(h => h.includes('sales'));
                const costIdx = headers.findIndex(h => h.includes('cost'));
                const feesIdx = headers.findIndex(h => h.includes('fees') || h.includes('fee'));
                const returnsIdx = headers.findIndex(h => h.includes('return'));
                const soldIdx = headers.findIndex(h => h.includes('unit') || h.includes('sold'));

                if (dateIdx === -1) {
                    debugLog += `Row ${i}: Skipped (Missing Date Column)\n`;
                    info.skipped++;
                    continue;
                }

                const date = row[dateIdx];

                // Robust Platform Detection
                let platform = 'amazon';
                if (platformIdx > -1) {
                    const rawPlat = (row[platformIdx] || '').toLowerCase().trim();
                    if (rawPlat.includes('noon')) platform = 'noon';
                    else if (rawPlat.includes('amazon')) platform = 'amazon';
                }

                // Clean Values
                const cleanVal = (val) => parseFloat((val || '').toString().replace(/[^0-9.-]+/g, "")) || 0;
                const sales = salesIdx > -1 ? cleanVal(row[salesIdx]) : 0;
                const cost = costIdx > -1 ? cleanVal(row[costIdx]) : 0;
                const fees = feesIdx > -1 ? cleanVal(row[feesIdx]) : 0;
                const returns = returnsIdx > -1 ? cleanVal(row[returnsIdx]) : 0;
                const sold = soldIdx > -1 ? parseInt((row[soldIdx] || '0').toString().replace(/[^0-9]/g, "")) || 0 : 0;

                const added = addToAgg(date, platform, sales, cost, fees, returns, sold, 0, 0);
                if (added) {
                    rowsProcessed++;
                    // Update Stats
                    const pKey = platform === 'noon' ? 'noon' : 'amazon';
                    info[pKey].count++;
                    info[pKey].sales += sales;
                } else {
                    debugLog += `Row ${i}: Skipped (Date '${date}' logic rejected)\n`;
                    info.skipped++;
                }
            }
        }

        if (rowsProcessed > 0) {
            ['today', 'yesterday', 'all'].forEach(dKey => {
                // FIXED: Always check both platforms. The aggregation object is safe to iterate.
                const pKeys = ['amazon', 'noon'];
                pKeys.forEach(pKey => {
                    const target = rawData[dKey][pKey];
                    const source = aggregation[dKey][pKey];

                    if (source.sales > 0 || source.cost > 0 || source.fees > 0 || source.returns > 0 || source.sold > 0 || source.totalSkus > 0) {
                        target.sales += source.sales;
                        target.cost += source.cost;
                        target.fees += source.fees;
                        target.returns += source.returns;
                        target.sold += source.sold;
                        target.liveSkus += source.liveSkus;
                        target.totalSkus += source.totalSkus;
                        target.weekly = [40, 60, 45, 70, 50, 65, 80];
                    }
                });
            });

            saveData();

            // Detailed Report
            const amazonMsg = info.amazon.count > 0 ? `Amazon: ${info.amazon.count} rows (Sales: ${info.amazon.sales.toFixed(2)})` : "";
            const noonMsg = info.noon.count > 0 ? `Noon: ${info.noon.count} rows (Sales: ${info.noon.sales.toFixed(2)})` : "";

            alert(`Import Successful! (${format})\n\n${noonMsg}\n${amazonMsg}`);

            // AUTO SWITCH TABS
            if (info.noon.count > 0 && info.amazon.count === 0) {
                const noonTab = document.querySelector('button[data-platform="noon"]');
                if (noonTab) noonTab.click();
            } else if (info.amazon.count > 0 && info.noon.count === 0) {
                const amzTab = document.querySelector('button[data-platform="amazon"]');
                if (amzTab) amzTab.click();
            } else {
                renderView();
            }

        } else {
            alert(`No valid rows processed.\n\nDebug Info:\nFormat: ${format}\nSkipped: ${info.skipped}\n\nLog:\n${debugLog}`);
        }
    }

    // --- Export Logic ---
    function prepareReportData() {
        const timestamp = new Date().toISOString().split('T')[0];
        let dateLabel = currentDate === 'today' ? 'Today' :
            currentDate === 'yesterday' ? 'Yesterday' :
                currentDate === 'month' ? 'Current Month' :
                    currentDate === 'custom' ? 'Custom Range' : 'Last 365 Days';

        let rows = [
            ['Generated', timestamp],
            ['Report', 'E-commerce Management MIS'],
            [],
            ['SUMMARY DATA'],
            ['Type', 'Date Period', 'Platform', 'Sales', 'Cost', 'Fees', 'Margin']
        ];

        // 1. Calculate Stats (Custom or Cached)
        let statsAmazon = { sales: 0, cost: 0, fees: 0 };
        let statsNoon = { sales: 0, cost: 0, fees: 0 };

        if (currentDate === 'custom' || currentDate === 'month' || currentDate === 'all') {
            let start, end;
            if (currentDate === 'month') {
                const now = new Date();
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                end = new Date();
            } else if (currentDate === 'all') {
                const now = new Date();
                start = new Date(now);
                start.setFullYear(start.getFullYear() - 1);
                end = new Date();
            } else {
                const startEl = document.getElementById('date-start');
                const endEl = document.getElementById('date-end');
                if (startEl && endEl && startEl.value && endEl.value) {
                    start = new Date(startEl.value);
                    end = new Date(endEl.value);
                }
            }

            if (start && end) {
                start.setHours(0, 0, 0, 0);
                end.setHours(23, 59, 59, 999);

                if (rawData.detailedOrders) {
                    rawData.detailedOrders.forEach(o => {
                        const oDate = new Date(o.date);
                        if (oDate >= start && oDate <= end) {
                            if (o.platform === 'Amazon') {
                                statsAmazon.sales += o.amount || 0;
                                statsAmazon.fees += o.fees || 0;
                                statsAmazon.cost += o.cost || 0;
                            } else if (o.platform === 'Noon') {
                                statsNoon.sales += o.amount || 0;
                                statsNoon.fees += o.fees || 0;
                                statsNoon.cost += o.cost || 0;
                            }
                        }
                    });
                }
            }
        } else {
            // Standard Timeframes
            if (rawData[currentDate]) {
                if (rawData[currentDate].amazon) statsAmazon = rawData[currentDate].amazon;
                if (rawData[currentDate].noon) statsNoon = rawData[currentDate].noon;
            }
        }

        // 2. Add Summary Rows
        const addRow = (pLabel, d) => {
            const margin = (d.sales - d.cost - (d.fees || 0)).toFixed(2);
            rows.push(['Aggregated', dateLabel, pLabel, d.sales.toFixed(2), d.cost.toFixed(2), d.fees.toFixed(2), margin]);
        };

        if (currentPlatform === 'all' || currentPlatform === 'amazon') {
            addRow('Amazon', statsAmazon);
        }
        if (currentPlatform === 'all' || currentPlatform === 'noon') {
            addRow('Noon', statsNoon);
        }

        // 3. Add Detailed Orders
        rows.push([], ['DETAILED ORDERS'], ['Order ID', 'Date', 'Platform', 'Status', 'Amount', 'Currency', 'Fees', 'Cost']);

        let start, end;
        if (currentDate === 'month') {
            const now = new Date();
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            end = new Date();
            start.setHours(0, 0, 0, 0); end.setHours(23, 59, 59, 999);
        } else if (currentDate === 'custom') {
            const s = document.getElementById('date-start');
            const e = document.getElementById('date-end');
            if (s && e) {
                start = new Date(s.value); start.setHours(0, 0, 0, 0);
                end = new Date(e.value); end.setHours(23, 59, 59, 999);
            }
        }

        if (rawData.detailedOrders) {
            rawData.detailedOrders.forEach(o => {
                let include = false;
                const oDate = new Date(o.date);

                if (currentDate === 'today' && isSameDay(oDate, todayDate)) include = true;
                else if (currentDate === 'yesterday' && isSameDay(oDate, yesterdayDate)) include = true;
                else if (currentDate === 'all') include = true;
                else if ((currentDate === 'custom' || currentDate === 'month') && start && end && oDate >= start && oDate <= end) include = true;

                if (include) {
                    if (currentPlatform === 'all' || o.platform.toLowerCase() === currentPlatform) {
                        rows.push([
                            o.id,
                            o.date.split('T')[0],
                            o.platform,
                            o.status,
                            (o.amount || 0).toFixed(2),
                            o.currency,
                            (o.fees || 0).toFixed(2),
                            (o.cost || 0).toFixed(2)
                        ]);
                    }
                }
            });
        }
        return rows;
    }

    function downloadCsv() {
        const rows = prepareReportData();
        const csvContent = rows.map(row => {
            return row.map(cell => {
                const cellStr = String(cell);
                if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
                    return `"${cellStr.replace(/"/g, '""')}"`;
                }
                return cellStr;
            }).join(',');
        }).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `mis_report_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    async function downloadExcel() {
        const rows = prepareReportData();
        const apiStatus = document.getElementById('api-status');
        if (apiStatus) apiStatus.textContent = "Generating Excel...";

        try {
            const response = await fetch('https://ecommerce-mis-report.onrender.com/api/generate-excel', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rows: rows })
            });

            if (!response.ok) throw new Error("Server Error");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mis_report_${new Date().toISOString().split('T')[0]}.xlsx`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            if (apiStatus) apiStatus.textContent = "Excel Downloaded.";
        } catch (err) {
            alert("Ensure Local Server is running for Excel generation.\n" + err.message);
            if (apiStatus) apiStatus.textContent = "Excel Failed.";
        }
    }

    // --- Event Listeners (Restored) ---
    const fileInput = document.getElementById('file-upload');
    const uploadBtn = document.getElementById('upload-btn');

    if (uploadBtn) {
        uploadBtn.addEventListener('click', () => {
            fileInput.click();
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', async (event) => {
            const file = event.target.files[0];
            if (file) {
                // Check if Excel
                if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                    const formData = new FormData();
                    formData.append('file', file);

                    try {
                        // Send to local server for conversion
                        const resp = await fetch('https://ecommerce-mis-report.onrender.com/api/convert-excel', {
                            method: 'POST',
                            body: formData
                        });

                        const result = await resp.json();
                        if (resp.ok && result.success) {
                            // DEBUG: Show the user what the server saw
                            const preview = result.csv.split('\n').slice(0, 5).join('\n');
                            const proceed = confirm(`Server Read Success!\n\nHere is the raw data (First 5 lines):\n\n${preview}\n\nClick OK to process this data.`);

                            if (proceed) {
                                processCSV(result.csv);
                            }
                        } else {
                            alert('Excel Conversion Failed: ' + (result.error || 'Server Error'));
                        }
                    } catch (err) {
                        alert('To upload Excel files, the "Local Server" must be running.\n\nCMD > cd server > node server.js');
                    }
                } else {
                    // Standard CSV
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const text = e.target.result;
                        processCSV(text);
                    };
                    reader.readAsText(file);
                }
            }
        });
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentPlatform = tab.getAttribute('data-platform');
            renderView();
        });
    });

    dateBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            dateBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentDate = btn.getAttribute('data-date');

            // Toggle Custom Inputs
            const customInputs = document.getElementById('custom-date-inputs');
            if (customInputs) {
                customInputs.style.display = currentDate === 'custom' ? 'flex' : 'none';
            }

            renderView();
        });
    });

    // Custom Date Range Listeners
    const startDateInput = document.getElementById('date-start');
    const endDateInput = document.getElementById('date-end');
    if (startDateInput && endDateInput) {
        startDateInput.addEventListener('change', renderView);
        endDateInput.addEventListener('change', renderView);
    }

    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadCsv);
    }

    const downloadXlsxBtn = document.getElementById('download-xlsx-btn');
    if (downloadXlsxBtn) {
        downloadXlsxBtn.addEventListener('click', downloadExcel);
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', resetData);
    }

    // --- API Integrations Logic ---
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const testApiBtn = document.getElementById('test-api-btn');
    const apiStatusDiv = document.getElementById('api-status');

    const amazonInput = document.getElementById('amazon-token');
    const clientIdInput = document.getElementById('client-id');
    const clientSecretInput = document.getElementById('client-secret');
    const marketplaceInput = document.getElementById('marketplace-select');

    // Noon Inputs
    const noonBizInput = document.getElementById('noon-business-id');
    const noonKeyInput = document.getElementById('noon-app-key');
    const noonTokenInput = document.getElementById('noon-auth-token');

    // Load Settings
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['amazonToken', 'clientId', 'clientSecret', 'marketplaceId', 'noonBiz', 'noonKey', 'noonToken'], function (result) {
                    if (result.amazonToken) amazonInput.value = result.amazonToken;
                    if (result.clientId) clientIdInput.value = result.clientId;
                    if (result.clientSecret) clientSecretInput.value = result.clientSecret;
                    if (result.marketplaceId) marketplaceInput.value = result.marketplaceId;

                    if (result.noonBiz) noonBizInput.value = result.noonBiz;
                    if (result.noonKey) noonKeyInput.value = result.noonKey;
                    if (result.noonToken) noonTokenInput.value = result.noonToken;
                });
            }
            apiStatusDiv.textContent = '';
            settingsModal.classList.remove('hidden');
        });
    }

    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', () => {
            settingsModal.classList.add('hidden');
        });
    }

    // Save Settings
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', () => {
            const token = amazonInput.value.trim();
            const cid = clientIdInput.value.trim();
            const sec = clientSecretInput.value.trim();
            const mpId = marketplaceInput.value;

            const nBiz = noonBizInput.value.trim();
            const nKey = noonKeyInput.value.trim();
            const nTok = noonTokenInput.value.trim();

            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.set({
                    amazonToken: token,
                    clientId: cid,
                    clientSecret: sec,
                    marketplaceId: mpId,
                    noonBiz: nBiz,
                    noonKey: nKey,
                    noonToken: nTok
                }, () => {
                    alert('Credentials & Region Saved!');
                    settingsModal.classList.add('hidden');
                });
            } else {
                alert('Credentials saved (mock).');
                settingsModal.classList.add('hidden');
            }
        });
    }

    // Live Sync (requires local server)
    // Live Sync (Unified Logic)
    const quickSyncBtn = document.getElementById('quick-sync-btn');

    async function performSync(creds = null) {
        // UI Feedback
        const statusEl = document.getElementById('api-status');
        const lastUpEl = document.getElementById('last-updated');

        if (statusEl) { statusEl.textContent = "Starting Sync..."; statusEl.style.color = "blue"; }
        if (lastUpEl) lastUpEl.textContent = "Syncing...";

        // 1. Get Credentials
        let token, cid, sec, mpId, nBiz, nKey, nToken;

        if (creds) {
            ({ token, cid, sec, mpId, nBiz, nKey, nToken } = creds);
        } else {
            const result = await new Promise(resolve =>
                chrome.storage.local.get(['amazonToken', 'clientId', 'clientSecret', 'marketplaceId', 'noonBiz', 'noonKey', 'noonToken'], resolve)
            );
            token = result.amazonToken;
            cid = result.clientId;
            sec = result.clientSecret;
            mpId = result.marketplaceId || 'A2VIGQ35RCS4UG';
            nBiz = result.noonBiz;
            nKey = result.noonKey;
            nToken = result.noonToken;
        }

        let syncMessages = [];

        // --- 1. SYNC AMAZON ---
        if (token && cid && sec) {
            try {
                if (statusEl) statusEl.textContent = "Syncing Amazon...";
                const response = await fetch('https://ecommerce-mis-report.onrender.com/api/fetch-sales', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        refreshToken: token, clientId: cid, clientSecret: sec, marketplaceId: mpId, dateRange: '30days'
                    })
                });

                const result = await response.json();
                if (response.ok && result.success && result.data) {
                    // Update Buckets
                    ['today', 'yesterday', 'all'].forEach(k => {
                        if (result.data[k]) {
                            // Merge bucket counts properly? 
                            // Actually, bucket counts from server are for the requested range. 
                            // If we request 30 days, 'all' bucket is only 30 days.
                            // However, we rely on detailedOrders recalculation in renderView() so these buckets are just temporary placeholders or for fast 'today' display.
                            rawData[k].amazon = { ...rawData[k].amazon, ...result.data[k] };
                        }
                    });

                    // Update Detailed Orders (Smart Merge)
                    if (result.data.ordersList) {
                        const cutoff = result.data.cutoffDate ? new Date(result.data.cutoffDate) : null;
                        if (cutoff) {
                            // Retain orders OLDER than the cutoff from Amazon
                            rawData.detailedOrders = rawData.detailedOrders.filter(o => o.platform !== 'Amazon' || new Date(o.date) < cutoff);
                        } else {
                            // Fallback: Clear all Amazon
                            rawData.detailedOrders = rawData.detailedOrders.filter(o => o.platform !== 'Amazon');
                        }

                        result.data.ordersList.forEach(order => {
                            rawData.detailedOrders.push({
                                id: order.id, date: order.date, platform: 'Amazon',
                                amount: order.amount, fees: order.fees || 0, cost: order.cost || 0,
                                status: order.status, currency: order.currency,
                                feeType: order.feeType, feeError: order.feeError,
                                invoiceRef: order.invoiceRef, units: order.units, skus: order.skus
                            });
                        });
                    }

                    syncMessages.push("✅ Amazon Synced");
                } else {
                    syncMessages.push("❌ Amazon Error: " + (result.error || 'Unknown'));
                }
            } catch (err) {
                syncMessages.push("❌ Amazon Failed: " + err.message);
            }
        } else {
            syncMessages.push("ℹ️ Amazon: Skipped (Missing Creds)");
        }

        // --- 2. SYNC NOON ---
        if (nBiz && nToken) {
            try {
                if (statusEl) statusEl.textContent = "Syncing Noon...";
                const response = await fetch('https://ecommerce-mis-report.onrender.com/api/fetch-noon-sales', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectCode: nBiz, keyId: nKey, keySecret: nToken, dateRange: '30days' })
                });

                const result = await response.json();
                if (response.ok && result.success && result.data) {
                    // Update Buckets
                    ['today', 'yesterday', 'all'].forEach(k => {
                        if (result.data[k]) {
                            rawData[k].noon = { ...rawData[k].noon, ...result.data[k] };
                        }
                    });

                    // Update Detailed Orders (Smart Merge)
                    if (result.data.ordersList) {
                        const cutoff = result.data.cutoffDate ? new Date(result.data.cutoffDate) : null;
                        if (cutoff) {
                            rawData.detailedOrders = rawData.detailedOrders.filter(o => o.platform !== 'Noon' || new Date(o.date) < cutoff);
                        } else {
                            rawData.detailedOrders = rawData.detailedOrders.filter(o => o.platform !== 'Noon');
                        }

                        result.data.ordersList.forEach(order => {
                            rawData.detailedOrders.push({
                                id: order.id, date: order.date, platform: 'Noon',
                                amount: order.amount, fees: order.fees || 0, cost: order.cost || 0,
                                status: order.status, currency: order.currency,
                                invoiceRef: order.invoiceRef, units: order.units, skus: order.skus
                            });
                        });
                    }
                    syncMessages.push("✅ Noon Synced");
                } else {
                    syncMessages.push("❌ Noon Error: " + (result.error || 'Unknown'));
                }
            } catch (err) {
                syncMessages.push("❌ Noon Failed: " + err.message);
            }
        } else {
            syncMessages.push("ℹ️ Noon: Skipped (Missing Creds)");
        }

        // Finalize
        // Deduplicate Orders by ID
        const uniqueOrders = new Map();
        rawData.detailedOrders.forEach(o => {
            if (o.id) uniqueOrders.set(o.id, o);
        });
        rawData.detailedOrders = Array.from(uniqueOrders.values());

        rawData.lastUpdated = new Date().toISOString();
        saveData();
        renderView();

        if (statusEl) statusEl.textContent = "Done.";

        // Auto-Retry Estimates (Background)
        retryEstimatedFees(token, cid, sec).catch(console.error);

        // Feedback
        if (syncMessages.some(m => m.includes('✅'))) {
            // Success
            if (lastUpEl) lastUpEl.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
            if (statusEl) statusEl.style.color = "green";
            if (creds) { // Only close modal if triggered from Settings
                settingsModal.classList.add('hidden');
                alert(`Sync Complete:\n\n${syncMessages.join('\n')}`);
            } else {
                // Quick Sync Feedback
                // No alert, just UI update + maybe console
                console.log("Quick Sync Full Report:", syncMessages);
            }
        } else {
            // Failure
            if (lastUpEl) lastUpEl.textContent = "Sync Failed";
            alert(`Sync Issues:\n\n${syncMessages.join('\n')}`);
        }
    }

    if (testApiBtn) {
        testApiBtn.addEventListener('click', () => {
            performSync({
                token: amazonInput.value.trim(),
                cid: clientIdInput.value.trim(),
                sec: clientSecretInput.value.trim(),
                mpId: marketplaceInput.value || 'A2VIGQ35RCS4UG',
                nBiz: noonBizInput.value.trim(),
                nKey: noonKeyInput.value.trim(),
                nToken: noonTokenInput.value.trim()
            });
        });
    }

    if (quickSyncBtn) {
        quickSyncBtn.addEventListener('click', () => {
            performSync(); // No args = Load from storage
        });
    }

    // Deep Sync Logic (Chunked)
    const deepSyncBtn = document.getElementById('deep-sync-btn');
    if (deepSyncBtn) {
        deepSyncBtn.addEventListener('click', async () => {
            if (!confirm("Start Deep Sync?\n\nThis will fetch data month-by-month for the last 12 months. It may take 1-2 minutes. Please do not close the popup.")) return;

            const statusEl = document.getElementById('api-status');
            if (statusEl) statusEl.textContent = "Starting Deep Sync...";

            const result = await new Promise(resolve =>
                chrome.storage.local.get(['amazonToken', 'clientId', 'clientSecret', 'marketplaceId', 'noonBiz', 'noonKey', 'noonToken'], resolve)
            );

            // 1. Generate 12 chunks
            const chunks = [];
            const now = new Date();
            for (let i = 0; i < 12; i++) {
                const end = new Date(now.getFullYear(), now.getMonth() - i, 1); // Start of current month (going back)
                // Actually end should be end of month? Let's do:
                // Chunk 0: Today back to 30 days ago? No, let's do safe monthly blocks.
                // Let's use strict Start/End dates.

                // End date for this chunk
                const eDate = new Date(now);
                eDate.setMonth(eDate.getMonth() - i);
                eDate.setDate(31); // Ensure end of month coverage (JS handles overflow)

                // Start date for this chunk
                const sDate = new Date(eDate);
                sDate.setDate(sDate.getDate() - 30); // 30 day chunks

                if (i === 0) {
                    // First chunk: Today
                    const today = new Date();
                    chunks.push({ start: sDate, end: today });
                } else {
                    chunks.push({ start: sDate, end: eDate });
                }
            }

            // 2. Iterate
            let successCount = 0;
            for (const [idx, chunk] of chunks.entries()) {
                if (statusEl) statusEl.textContent = `Syncing Chunk ${idx + 1}/12... (${chunk.start.toLocaleDateString()})`;

                try {
                    // Amazon Chunk
                    if (result.amazonToken) {
                        await fetch('https://ecommerce-mis-report.onrender.com/api/fetch-sales', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                refreshToken: result.amazonToken, clientId: result.clientId, clientSecret: result.clientSecret, marketplaceId: result.marketplaceId,
                                customStartDate: chunk.start.toISOString(),
                                customEndDate: chunk.end.toISOString()
                            })
                        }).then(r => r.json()).then(res => {
                            if (res.success && res.data && res.data.ordersList) {
                                const chunkOrders = res.data.ordersList;
                                // Smart Merge
                                rawData.detailedOrders = rawData.detailedOrders.filter(o =>
                                    o.platform !== 'Amazon' ||
                                    new Date(o.date) < chunk.start || new Date(o.date) > chunk.end
                                );
                                chunkOrders.forEach(order => {
                                    rawData.detailedOrders.push({
                                        id: order.id, date: order.date, platform: 'Amazon',
                                        amount: order.amount, fees: order.fees || 0, cost: order.cost || 0,
                                        status: order.status, currency: order.currency,
                                        feeType: order.feeType, feeError: order.feeError,
                                        invoiceRef: order.invoiceRef, units: order.units, skus: order.skus
                                    });
                                });
                            }
                        }).catch(e => console.warn("Chunk fail", e));
                    }

                    // Noon Chunk
                    if (result.noonBiz && result.noonKey && result.noonToken) {
                        try {
                            const noonRes = await fetch('https://ecommerce-mis-report.onrender.com/api/fetch-noon-sales', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    businessId: result.noonBiz, token: result.noonToken, keyId: result.noonKey,
                                    customStartDate: chunk.start.toISOString(),
                                    customEndDate: chunk.end.toISOString()
                                })
                            }).then(r => r.json());

                            if (noonRes.success && noonRes.data && noonRes.data.ordersList) {
                                const chunkOrders = noonRes.data.ordersList;
                                // Smart Merge for Noon
                                rawData.detailedOrders = rawData.detailedOrders.filter(o =>
                                    o.platform !== 'Noon' ||
                                    new Date(o.date) < chunk.start || new Date(o.date) > chunk.end
                                );
                                chunkOrders.forEach(order => {
                                    rawData.detailedOrders.push({
                                        id: order.id, date: order.date, platform: 'Noon',
                                        amount: order.amount, fees: order.fees || 0, cost: order.cost || 0,
                                        status: order.status, currency: order.currency,
                                        feeType: order.feeType,
                                        invoiceRef: order.invoiceRef, units: order.units, skus: order.skus
                                    });
                                });
                            }
                        } catch (e) {
                            console.warn("Noon Chunk fail", e);
                        }
                    }

                    successCount++;
                } catch (err) {
                    console.error("Deep Sync Error:", err);
                }

                // Slight delay
                await new Promise(r => setTimeout(r, 1000));
            }

            // Final Deduplication
            const uniqueOrders = new Map();
            rawData.detailedOrders.forEach(o => {
                if (o.id) uniqueOrders.set(o.id, o);
            });
            rawData.detailedOrders = Array.from(uniqueOrders.values());

            if (statusEl) statusEl.textContent = "Deep Sync Complete!";
            rawData.lastUpdated = new Date().toISOString();
            saveData();
            renderView();
            alert("Deep Sync Finished. Check Dashboard.");
        });
    }

    // Reuse performSync for normal buttons...
    // Retry Mechanism for Estimates
    async function retryEstimatedFees(token, cid, sec) {
        // Find recent orders (365 days) with Estimated fees
        const now = new Date();
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(now.getFullYear() - 1);

        const candidates = rawData.detailedOrders.filter(o =>
            o.platform === 'Amazon' &&
            new Date(o.date) >= oneYearAgo &&
            (!o.feeType || o.feeType.startsWith('Est') || o.feeType === 'Estimated')
        );

        if (candidates.length === 0) return;

        console.log(`Found ${candidates.length} orders with Estimated fees. Retrying...`);
        document.getElementById('api-status').textContent = `Refining ${candidates.length} Fees...`;

        // Chunking (Batch of 5 to avoid timeouts)
        const chunks = [];
        for (let i = 0; i < candidates.length; i += 5) {
            chunks.push(candidates.slice(i, i + 5).map(o => o.id));
        }

        for (const chunk of chunks) {
            try {
                const response = await fetch('https://ecommerce-mis-report.onrender.com/api/refresh-fees', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        refreshToken: token, clientId: cid, clientSecret: sec,
                        orderIds: chunk
                    })
                });
                const result = await response.json();
                if (result.success && result.data) {
                    // Update Local Data
                    let updatedCount = 0;
                    result.data.forEach(update => {
                        const target = rawData.detailedOrders.find(o => o.id === update.id);
                        if (target) {
                            target.fees = update.fees;
                            target.feeType = update.feeType;
                            target.feeError = update.feeError;
                            updatedCount++;
                        }
                    });
                    // Save and Render per Chunk for Live Feedback
                    if (updatedCount > 0) {
                        saveData();
                        renderView();
                        document.getElementById('api-status').textContent = `Refining... (${updatedCount} updated)`;
                    }
                }
            } catch (e) {
                console.error("Retry Chunk Failed:", e);
            }
        }
    }

    // Initialize (Load from Storage)
    loadData();

    // Explore Dashboard Button
    const exploreBtn = document.getElementById('exploreBtn');
    if (exploreBtn) {
        exploreBtn.addEventListener('click', () => {
            if (typeof chrome !== 'undefined' && chrome.tabs) {
                chrome.tabs.create({ url: 'explore.html' });
            } else {
                window.open('explore.html', '_blank');
            }
        });
    }

    // Market Trends Button
    const trendsBtn = document.getElementById('trendsBtn');
    if (trendsBtn) {
        trendsBtn.addEventListener('click', () => {
            if (typeof chrome !== 'undefined' && chrome.tabs) {
                chrome.tabs.create({ url: 'market_trends.html' });
            } else {
                window.open('market_trends.html', '_blank');
            }
        });
    }

    // Reset Data Listener
    if (resetBtn) {
        resetBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('This will purge all saved data and force a full re-sync. Proceed?')) {
                chrome.storage.local.clear(() => {
                    location.reload();
                });
            }
        });
    }
});
