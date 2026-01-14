const xmlrpc = require('xmlrpc');
require('dotenv').config();

class OdooClient {
    constructor() {
        this.url = process.env.ODOO_URL || 'https://erp.r3factory.com/';
        this.db = process.env.ODOO_DB || 'r3_erp_db';
        this.username = process.env.ODOO_USERNAME || 'preethi@r3factory.ae';
        this.password = process.env.ODOO_PASSWORD || 'preethi@r3';

        if (!this.url) console.warn("Odoo URL not set in environment variables.");

        const urlParams = new URL(this.url || 'http://localhost');
        this.rpcConfig = {
            host: urlParams.hostname,
            port: urlParams.port || (urlParams.protocol === 'https:' ? 443 : 80),
            path: '/xmlrpc/2/',
            secure: urlParams.protocol === 'https:'
        };
    }

    async connect() {
        if (!this.db || !this.username || !this.password) throw new Error("Missing Odoo credentials");

        const client = this.rpcConfig.secure
            ? xmlrpc.createSecureClient({ ...this.rpcConfig, path: '/xmlrpc/2/common' })
            : xmlrpc.createClient({ ...this.rpcConfig, path: '/xmlrpc/2/common' });

        return new Promise((resolve, reject) => {
            client.methodCall('authenticate', [this.db, this.username, this.password, {}], (error, uid) => {
                if (error) reject(error);
                else if (!uid) reject(new Error("Authentication failed"));
                else { this.uid = uid; resolve(uid); }
            });
        });
    }

    async fetchProducts(limit = 10, offset = 0, domain = []) {
        if (!this.uid) await this.connect();
        const client = this.rpcConfig.secure ? xmlrpc.createSecureClient({ ...this.rpcConfig, path: '/xmlrpc/2/object' }) : xmlrpc.createClient({ ...this.rpcConfig, path: '/xmlrpc/2/object' });
        return new Promise((resolve, reject) => {
            client.methodCall('execute_kw', [this.db, this.uid, this.password, 'product.product', 'search_read', [domain], { fields: ['name', 'standard_price', 'default_code', 'barcode', 'qty_available', 'categ_id'], limit: limit, offset: offset }], (error, products) => {
                if (error) reject(error); else resolve(products);
            });
        });
    }

    async fetchCostsForSkus(skus) {
        if (!skus || skus.length === 0) return {};
        if (!this.uid) await this.connect();
        const client = this.rpcConfig.secure ? xmlrpc.createSecureClient({ ...this.rpcConfig, path: '/xmlrpc/2/object' }) : xmlrpc.createClient({ ...this.rpcConfig, path: '/xmlrpc/2/object' });
        return new Promise((resolve, reject) => {
            client.methodCall('execute_kw', [this.db, this.uid, this.password, 'product.product', 'search_read', [[['default_code', 'in', skus]]], { fields: ['default_code', 'standard_price', 'name'] }], (error, products) => {
                if (error) { console.error("Odoo SKU Fetch Error:", error); resolve({}); }
                else {
                    const costMap = {};
                    products.forEach(p => { if (p.default_code) costMap[p.default_code] = p.standard_price || 0; });
                    resolve(costMap);
                }
            });
        });
    }

    async fetchPartnerId(name) {
        if (!name) return null;
        if (this.partnerCache && this.partnerCache[name]) return this.partnerCache[name];

        if (!this.uid) await this.connect();
        const client = this.rpcConfig.secure
            ? xmlrpc.createSecureClient({ ...this.rpcConfig, path: '/xmlrpc/2/object' })
            : xmlrpc.createClient({ ...this.rpcConfig, path: '/xmlrpc/2/object' });

        return new Promise((resolve, reject) => {
            client.methodCall('execute_kw', [this.db, this.uid, this.password, 'res.partner', 'search', [[['name', '=', name]]], { limit: 1 }], (err, ids) => {
                if (err) { console.error("Partner Fetch Error:", err); resolve(null); }
                else {
                    const id = ids && ids.length > 0 ? ids[0] : null;
                    if (!this.partnerCache) this.partnerCache = {};
                    this.partnerCache[name] = id;
                    resolve(id);
                }
            });
        });
    }

    async fetchInvoicesByReferences(references, partnerName = null) {
        if (!references || references.length === 0) return {};
        if (!this.uid) await this.connect();

        let partnerId = null;
        if (partnerName) {
            partnerId = await this.fetchPartnerId(partnerName);
            if (!partnerId) console.warn(`⚠️ Odoo: Partner '${partnerName}' not found. Verify spelling.`);
        }

        const client = this.rpcConfig.secure
            ? xmlrpc.createSecureClient({ ...this.rpcConfig, path: '/xmlrpc/2/object' })
            : xmlrpc.createClient({ ...this.rpcConfig, path: '/xmlrpc/2/object' });

        const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
        const batches = chunk(references, 100);
        const masterInvoiceMap = {};

        for (const batchRefs of batches) {
            // STEP 1: Pre-fetch Sale Orders to find indirect links (Amazon ID -> SO Name)
            const soMap = {};
            try {
                await new Promise((resolve) => {
                    client.methodCall('execute_kw', [this.db, this.uid, this.password, 'sale.order', 'search_read',
                    [[['client_order_ref', 'in', batchRefs]]],
                    { fields: ['name', 'client_order_ref'] }
                    ], (e, r) => {
                        if (!e && Array.isArray(r)) {
                            r.forEach(so => {
                                if (so.name && so.client_order_ref) soMap[so.name] = so.client_order_ref;
                            });
                        }
                        resolve();
                    });
                });
            } catch (e) { console.error("SO Lookup Error:", e); }

            // STEP 2: Fetch Invoices
            const searchList = [...batchRefs, ...Object.keys(soMap)];

            const batchMap = await new Promise((resolve, reject) => {
                let domain = ['|', '|', ['name', 'in', searchList], ['reference', 'in', searchList], ['origin', 'in', searchList]];
                if (partnerId) {
                    domain = ['&', ['partner_id', '=', partnerId], ...domain];
                }

                client.methodCall('execute_kw', [this.db, this.uid, this.password, 'account.invoice', 'search_read', [domain],
                { fields: ['name', 'reference', 'origin', 'date_invoice', 'amount_total', 'state', 'invoice_line_ids', 'number', 'partner_id'] }
                ], (error, invoices) => {
                    if (error) { console.error("Odoo Batch Fetch Error:", error); resolve({}); return; }
                    if (!invoices || !Array.isArray(invoices) || invoices.length === 0) { resolve({}); return; }

                    let allLineIds = [];
                    invoices.forEach(inv => {
                        if (inv.invoice_line_ids && Array.isArray(inv.invoice_line_ids)) allLineIds = allLineIds.concat(inv.invoice_line_ids);
                    });

                    if (allLineIds.length === 0) {
                        const map = {};
                        invoices.forEach(inv => {
                            let key = null;
                            if (batchRefs.includes(inv.name)) key = inv.name;
                            else if (batchRefs.includes(inv.reference)) key = inv.reference;
                            else if (batchRefs.includes(inv.origin)) key = inv.origin;

                            // Check SO Map
                            if (!key && soMap[inv.origin] && batchRefs.includes(soMap[inv.origin])) {
                                key = soMap[inv.origin];
                            }

                            if (key) {
                                inv.original_name = inv.name;
                                inv.name = inv.number || inv.name;
                                inv.payment_state = inv.state;
                                map[key] = inv;
                            }
                        });
                        resolve(map);
                        return;
                    }

                    client.methodCall('execute_kw', [this.db, this.uid, this.password, 'account.invoice.line', 'read', [allLineIds],
                    { fields: ['product_id', 'quantity', 'price_unit', 'purchase_price', 'invoice_id', 'name'] }
                    ], (err2, lines) => {
                        if (err2) { resolve({}); } else {
                            const productIds = new Set();
                            const potentialSerials = new Set();
                            const lineToSerialMap = {};

                            if (Array.isArray(lines)) {
                                lines.forEach(l => {
                                    if (l.product_id && Array.isArray(l.product_id)) productIds.add(l.product_id[0]);
                                    if (l.name) {
                                        const match = l.name.match(/\b\d{15}\b/);
                                        if (match) {
                                            const sn = match[0];
                                            potentialSerials.add(sn);
                                            lineToSerialMap[l.id] = sn;
                                        }
                                    }
                                });
                            }

                            const finishBatch = (pCosts = {}, lotCosts = {}) => {
                                const linesByInv = {};
                                if (Array.isArray(lines)) lines.forEach(l => {
                                    const invId = l.invoice_id ? l.invoice_id[0] : null;
                                    if (invId) { if (!linesByInv[invId]) linesByInv[invId] = []; linesByInv[invId].push(l); }
                                });

                                const map = {};
                                invoices.forEach(inv => {
                                    let key = null;
                                    if (batchRefs.includes(inv.name)) key = inv.name;
                                    else if (batchRefs.includes(inv.reference)) key = inv.reference;
                                    else if (batchRefs.includes(inv.origin)) key = inv.origin;

                                    // Check SO Map
                                    if (!key && soMap[inv.origin] && batchRefs.includes(soMap[inv.origin])) {
                                        key = soMap[inv.origin];
                                    }

                                    if (key) {
                                        inv.lines = linesByInv[inv.id] || [];
                                        let totalCost = 0;
                                        inv.lines.forEach(l => {
                                            let unitCost = 0;
                                            const serial = lineToSerialMap[l.id];
                                            if (serial && lotCosts[serial]) unitCost = lotCosts[serial];
                                            else if (l.purchase_price) unitCost = l.purchase_price;
                                            else if (l.product_id && Array.isArray(l.product_id)) unitCost = pCosts[l.product_id[0]] || 0;

                                            totalCost += (unitCost * (l.quantity || 0));
                                        });
                                        inv.total_cost = totalCost;
                                        inv.original_name = inv.name;
                                        inv.name = inv.number || inv.name;
                                        inv.payment_state = inv.state;
                                        map[key] = inv;
                                    }
                                });
                                resolve(map);
                            };

                            const performFinalStep = async () => {
                                let pCosts = {};
                                let lotCosts = {};
                                if (productIds.size > 0) {
                                    try {
                                        const prods = await new Promise((res, rej) => {
                                            client.methodCall('execute_kw', [this.db, this.uid, this.password, 'product.product', 'read', [Array.from(productIds)], { fields: ['standard_price'] }], (e, r) => e ? rej(e) : res(r));
                                        });
                                        if (Array.isArray(prods)) prods.forEach(p => pCosts[p.id] = p.standard_price || 0);
                                    } catch (e) { console.error("Prod Cost Error", e); }
                                }
                                if (potentialSerials.size > 0) {
                                    try {
                                        const serials = Array.from(potentialSerials);
                                        const lots = await new Promise((res, rej) => {
                                            client.methodCall('execute_kw', [this.db, this.uid, this.password, 'stock.production.lot', 'search_read', [[['name', 'in', serials]]], { fields: ['name', 'cost_price'] }], (e, r) => e ? rej(e) : res(r));
                                        });
                                        if (Array.isArray(lots)) lots.forEach(lot => lotCosts[lot.name] = lot.cost_price || 0);
                                    } catch (e) { console.error("Lot Cost Error", e); }
                                }
                                finishBatch(pCosts, lotCosts);
                            };
                            performFinalStep();
                        }
                    });
                });
            });
            Object.assign(masterInvoiceMap, batchMap);
        }
        return masterInvoiceMap;
    }


    async fetchRetailStock() {
        if (!this.uid) await this.connect();
        const client = this.rpcConfig.secure ? xmlrpc.createSecureClient({ ...this.rpcConfig, path: '/xmlrpc/2/object' }) : xmlrpc.createClient({ ...this.rpcConfig, path: '/xmlrpc/2/object' });

        return new Promise((resolve, reject) => {
            // 1. Find Lots where x_parent_loc is 'retail_loc'
            // This custom field tracks items assigned to Retail
            client.methodCall('execute_kw', [this.db, this.uid, this.password, 'stock.production.lot', 'search_read',
            [[['x_parent_loc', '=', 'retail_loc']]],
            { fields: ['id'], limit: 5000 }
            ], (err, lots) => {
                if (err) { console.error("Lot Search Error:", err); resolve([]); return; }
                if (!lots || lots.length === 0) { resolve([]); return; }

                const lotIds = lots.map(l => l.id);

                // 2. Find Quants for these Lots
                // Filter: Quantity = 1 (Serialized), Internal Location
                client.methodCall('execute_kw', [this.db, this.uid, this.password, 'stock.quant', 'search_read',
                [[['lot_id', 'in', lotIds], ['quantity', '=', 1], ['location_id.usage', '=', 'internal']]],
                { fields: ['product_id', 'quantity', 'location_id', 'lot_id'], limit: 5000 }
                ], (err2, quants) => {
                    if (err2) { console.error("Quant Search Error:", err2); resolve([]); return; }
                    resolve(quants);
                });
            });
        });
    }
    async searchLocations(term) {
        if (!this.uid) await this.connect();
        const client = this.rpcConfig.secure ? xmlrpc.createSecureClient({ ...this.rpcConfig, path: '/xmlrpc/2/object' }) : xmlrpc.createClient({ ...this.rpcConfig, path: '/xmlrpc/2/object' });

        return new Promise((resolve, reject) => {
            client.methodCall('execute_kw', [this.db, this.uid, this.password, 'stock.location', 'search_read',
            [[['name', 'ilike', term]]],
            { fields: ['name', 'complete_name'] }
            ], (err, res) => {
                if (err) reject(err); else resolve(res);
            });
        });
    }

    async fetchSalesOrdersByPartner(partnerName, limit = 50) {
        if (!this.uid) await this.connect();

        // 1. Get Partner ID
        let partnerId = await this.fetchPartnerId(partnerName);
        if (!partnerId) {
            console.warn(`⚠️ Partner '${partnerName}' not found.`);
            return [];
        }

        const client = this.rpcConfig.secure
            ? xmlrpc.createSecureClient({ ...this.rpcConfig, path: '/xmlrpc/2/object' })
            : xmlrpc.createClient({ ...this.rpcConfig, path: '/xmlrpc/2/object' });

        return new Promise((resolve, reject) => {
            // 2. Search Sale Orders
            const domain = [['partner_id', '=', partnerId]];

            client.methodCall('execute_kw', [this.db, this.uid, this.password, 'sale.order', 'search_read', [domain],
            {
                fields: ['name', 'date_order', 'amount_total', 'client_order_ref', 'state', 'order_line'],
                limit: limit,
                order: 'date_order desc'
            }], (err, orders) => {
                if (err) { console.error("SO Fetch Error:", err); resolve([]); return; }
                if (!orders || orders.length === 0) { resolve([]); return; }

                // 3. Fetch Order Lines
                const allLineIds = orders.flatMap(o => o.order_line || []);
                if (allLineIds.length === 0) { resolve(orders); return; }

                client.methodCall('execute_kw', [this.db, this.uid, this.password, 'sale.order.line', 'read', [allLineIds],
                { fields: ['product_id', 'price_unit', 'product_uom_qty', 'name', 'order_id'] }], (err2, lines) => {
                    if (err2) { console.error("SO Line Error:", err2); resolve(orders); return; }

                    // Attach lines to orders
                    const lineMap = {};
                    lines.forEach(l => {
                        const orderId = l.order_id ? l.order_id[0] : null;
                        if (orderId) {
                            if (!lineMap[orderId]) lineMap[orderId] = [];
                            lineMap[orderId].push(l);
                        }
                    });

                    orders.forEach(o => {
                        o.lines_details = lineMap[o.id] || [];
                    });
                    resolve(orders);
                });
            });
        });
    }
}

module.exports = new OdooClient();
