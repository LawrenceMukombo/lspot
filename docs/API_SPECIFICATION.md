# LSpot Restaurant Manager (LRM) — API Specification

## Base URL
`/api/v1`

## Standard Response Envelopes
### Success Response
```json
{
  "success": true,
  "message": "Operation completed successfully.",
  "data": {}
}
```

### Error Response
```json
{
  "success": false,
  "message": "Human-readable error explanation.",
  "code": "ERROR_CODE",
  "errors": []
}
```

---

## Key Endpoints Summary

### Authentication & Profile (`/api/v1/auth`)
- `POST /auth/login` — Authenticate user via username/email & password; returns JWT & user profile.
- `POST /auth/refresh` — Refresh expired access token.
- `POST /auth/verify-pin` — Verify 4-digit supervisor PIN for high-privilege operations.
- `GET /auth/me` — Retrieve current active session and permissions.

### Restaurant & Branches (`/api/v1/restaurant`)
- `GET /restaurant/profile` — Get The LSpot Restaurant profile and operational settings.
- `PUT /restaurant/profile` — Update address, logo, currency, tax rates, operating hours.
- `GET /restaurant/branches` — List active branches (Manyama Main Branch).

### Menu & Categories (`/api/v1/menu`)
- `GET /menu/categories` — List menu categories.
- `POST /menu/categories` — Create category.
- `GET /menu/items` — List salable dishes and beverages with availability and prices.
- `POST /menu/items` — Create new menu item with portion definitions.
- `PUT /menu/items/:id` — Update menu item, pricing, or availability status.

### Recipes & Ingredients (`/api/v1/recipes`)
- `GET /recipes` — List recipes with standard yields and ingredient BOM.
- `POST /recipes` — Create or update recipe with ingredients, batch quantity, and portion size.
- `POST /recipes/scale` — Dynamically calculate ingredient requirements for an arbitrary batch quantity.

### Daily Kitchen Production (`/api/v1/kitchen`)
- `GET /kitchen/registers/today` — Retrieve today's Daily Kitchen Production Register.
- `POST /kitchen/registers/open` — Open the kitchen production day.
- `POST /kitchen/issue-requests` — Create ingredient issue request from store to kitchen.
- `POST /kitchen/batches` — Create/record a cooking batch (planned vs actual portions).
- `POST /kitchen/consumption` — Log actual ingredient consumption.
- `POST /kitchen/waste` — Record kitchen waste or staff meals.
- `POST /kitchen/registers/close` — Reconcile remaining portions and close the production day.

### Inventory & Stock Movements (`/api/v1/inventory`)
- `GET /inventory/items` — Master list of stock items with balances across locations and WAC unit costs.
- `POST /inventory/items` — Create stock item (raw ingredients, beverages, packaging).
- `GET /inventory/movements` — Filterable perpetual stock movements ledger.
- `POST /inventory/receive` — Receive stock from supplier (goods receipt).
- `POST /inventory/transfer` — Transfer stock between locations (e.g. Main Store to Kitchen Store).
- `POST /inventory/adjust` — Manager-approved inventory adjustment (damage, shrinkage, count reconciliation).

### Point of Sale (POS) (`/api/v1/pos`)
- `GET /pos/catalog` — Fast cached catalog of available prepared food and beverages with live portion counts.
- `POST /pos/orders` — Create order cart.
- `POST /pos/checkout` — Finalize sale with atomic stock deduction and payment record (Cash, MoMo, Credit, Split).
- `GET /pos/sales` — List recent sales.
- `POST /pos/sales/:id/void` — Void or refund sale with supervisor PIN.

### Customer Credit & Accounts Receivable (`/api/v1/credit`)
- `GET /credit/customers` — List customers with credit limits, current balance, and terms.
- `POST /credit/customers` — Register individual or corporate credit customer.
- `GET /credit/customers/:id/ledger` — View customer transaction history and outstanding invoices.
- `POST /credit/payments` — Record customer debt payment (Cash, MoMo, Bank) with invoice allocation.
- `GET /credit/ageing` — Aged debtors report (Current, 30 days, 60 days, 90+ days).

### Invoices & Statements (`/api/v1/invoices`)
- `GET /invoices` — List generated invoices.
- `POST /invoices/consolidate-daily` — Generate consolidated daily credit invoice for a customer.
- `GET /invoices/:id/pdf` — Render professional PDF invoice layout.
- `POST /invoices/:id/send` — Queue invoice dispatch via Email or WhatsApp.

### Cashier Shifts & Cash Reconciliation (`/api/v1/shifts`)
- `POST /shifts/open` — Open cashier shift with opening float.
- `GET /shifts/current` — Current active shift metrics (cash sales, collections, expenses, expected cash).
- `POST /shifts/close` — Submit physical cash count, calculate overage/shortage, and close shift.
- `GET /shifts/history` — Shift history and audit reports.

### General Ledger & Financials (`/api/v1/finance`)
- `GET /finance/dashboard` — Executive metrics (Revenue, COGS, Gross Profit, Operating Expenses, Net Profit).
- `GET /finance/reports/pnl` — Profit & Loss statement for date range.
- `GET /finance/reports/sales` — Daily and item sales reports.
- `GET /finance/reports/kitchen-reconciliation` — Food production vs sales vs waste reconciliation report.
- `GET /finance/expenses` — List operating expenses.
- `POST /finance/expenses` — Record operating expense.

### Offline Sync Engine (`/api/v1/sync`)
- `POST /sync/push` — Ingest durable outbox command queue from offline mobile/tablet devices.
- `GET /sync/pull` — Delta sync updated menu, prices, and stock catalog to device SQLite.
