# MIS Report CSV Data Templates

This extension supports standard reports exported directly from **Noon** and **Amazon**. 
To ensure your data is read correctly, please use the following column headers. 

---

## 1. Noon Reports
You can upload either a **Financial Report** (recommended for accuracy) or an **Orders Report**.

### Option A: Noon Financial Report (Best for Sales, Fees, Margin)
*Export this from Noon Seller Lab > Payments > Statements*
**Required Columns:**
*   `Date` (e.g., `Statement Date` or `Transaction Date`)
*   `Transaction Type` / `Description` / `Details`: Used to identify "Refunds" vs "Sales" vs "Fees".
*   `Amount` / `VAT Inclusive`: The value of the transaction.
    *   **Positive** numbers are treated as **Sales**.
    *   **Negative** numbers containing "fee", "commission", "shipping", or "charge" are treated as **Mkt Fees**.
    *   Other **Negative** numbers are treated as **Total Cost** (Deductions).

**Example CSV Structure:**
```csv
Date,Transaction ID,Description,Amount
2024-12-01,1001,Order Payment,150.00
2024-12-01,1001,Sales Commission,-15.00
2024-12-01,1001,FBN Shipping Fee,-10.00
2024-12-02,1002,Customer Return,-150.00
```
*(In this example: Sales = 150, Fees = 25, Cost = 0, Returns = 150)*

### Option B: Noon Orders Report
*Export this from Noon Seller Lab > Core > Orders*
**Required Columns:**
*   `Date` / `Created At`
*   `Order Number`
*   `Grand Total` / `Total` / `Price`: Treated as **Sales**.
*   `FBN Fee` (Optional): Added to **Mkt Fees**.
*   `Marketplace Fee` / `Commission` (Optional): Added to **Mkt Fees**.
*   `Order Status`: If "Return" or "Refunded", the sale amount is counted as **Returns**.

**Example CSV Structure:**
```csv
Order Number,Date,Order Status,Grand Total,FBN Fee,Marketplace Fee
N12345678,01-12-2024,Delivered,100.00,-10.00,-5.00
N87654321,02-12-2024,Returned,200.00,-20.00,-10.00
```

---

## 2. Amazon Reports

### Option A: Date Range Report (Recommended)
*Export from Amazon Seller Central > Payments > Reports Repository > Date Range Reports (Transaction)*
**Required Columns:**
*   `date/time`
*   `type`: Must distinguish between `Order`, `Refund`, `Service Fee`, `Transfer`.
*   `product sales`: Treated as **Total Sales**.
*   `selling fees`: Added to **Mkt Fees**.
*   `fba fees`: Added to **Mkt Fees**.
*   `other transaction fees`: Added to **Mkt Fees**.
*   `total`: Used for Refund calculations.

**Example CSV Structure:**
```csv
date/time,settlement id,type,order id,sku,description,quantity,marketplace,fulfillment,order city,order state,order postal,tax collection model,product sales,product sales tax,shipping credits,shipping credits tax,gift wrap credits,giftwrap credits tax,Regulatory Fee,Tax on Regulatory Fee,promotional rebates,promotional rebates tax,marketplace withheld tax,selling fees,fba fees,other transaction fees,other,total
Dec 1, 2024 10:00:00 AM,,Order,123-456,,,1,amazon,,,,,MarketplaceFacilitator,100.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,0.00,-15.00,-20.00,0.00,0.00,65.00
```

### Option B: Business Report (Sales Only)
*Export from Amazon Seller Central > Reports > Business Reports*
**Required Columns:**
*   `Date`
*   `Ordered Product Sales`: Treated as **Sales**.
*   `Units Ordered`: Treated as **Sold Units**.
*(Note: This report does not contain Fees or Costs)*

---

## 3. Custom / Standard Fallback
If you are creating your own manual CSV, use this simple format to ensure it works on any platform.

**Required Columns:**
*   `Date` (Format: DD/MM/YYYY or YYYY-MM-DD)
*   `Platform` ("Amazon" or "Noon")
*   `Sales`: Positive number
*   `Cost`: Cost of Goods or Other Expenses (Positive number here will be subtracted from margin)
*   `Fees`: Marketplace Fees (Positive number here will be subtracted from margin)
*   `Returns`: Value of returned goods
*   `Units Sold`: Count

**Example CSV Structure (Manual Entry)**
```csv
Date,Platform,Sales,Cost,Fees,Returns,Units Sold
01/12/2024,Amazon,1000,400,200,0,10
01/12/2024,Noon,500,200,100,50,5
```
