const xmlrpc = require('xmlrpc');
require('dotenv').config();

class OdooClient {
    constructor() {
        this.url = process.env.ODOO_URL;
        this.db = process.env.ODOO_DB;
        this.username = process.env.ODOO_USERNAME;
        this.password = process.env.ODOO_PASSWORD;

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

    async fetchInvoicesByReferences(references) {
        if (!references || references.length === 0) return {};
        if (!this.uid) await this.connect();

        const client = this.rpcConfig.secure
            ? xmlrpc.createSecureClient({ ...this.rpcConfig, path: '/xmlrpc/2/object' })
            : xmlrpc.createClient({ ...this.rpcConfig, path: '/xmlrpc/2/object' });

        const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (v, i) => arr.slice(i * size, i * size + size));
        const batches = chunk(references, 100);
        const masterInvoiceMap = {};

        for (const batchRefs of batches) {
            const batchMap = await new Promise((resolve, reject) => {
                // Modified Domain: Check Origin as well!
                const domain = ['|', '|', ['name', 'in', batchRefs], ['reference', 'in', batchRefs], ['origin', 'in', batchRefs]];

                client.methodCall('execute_kw', [this.db, this.uid, this.password, 'account.invoice', 'search_read', [domain],
                { fields: ['name', 'reference', 'origin', 'date_invoice', 'amount_total', 'state', 'invoice_line_ids', 'number'] }
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
}

module.exports = new OdooClient();
