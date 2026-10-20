# LSpot Restaurant Manager (LRM) — Database Schema Specification

## 1. Relational Design Principles
- **Primary Keys**: UUID v4 for all primary entities to support distributed/offline generation without ID collision.
- **Tenant & Branch Scoping**: Mandatory `tenant_id` and `branch_id` across all operational records.
- **Monetary Precision**: `NUMERIC(14, 2)` or `DECIMAL(14, 2)` for all monetary values in Zambian Kwacha (ZMW).
- **Physical Quantities**: `NUMERIC(12, 4)` for all ingredient and stock quantities to accommodate fine kitchen measurements (e.g., 0.025 kg, 0.150 l).
- **Audit Columns**: `created_at`, `updated_at`, `created_by`, `updated_by` on all mutable records.
- **Immutability for Ledgers**: Stock movements, sales, payments, and journal entries are append-only. Corrections require adjusting entries.

---

## 2. Table Specifications

### Core & Tenancy
1. `tenants`: Multi-tenant organization accounts (default: The LSpot Restaurant).
2. `branches`: Physical locations (default: Manyama Main Branch).
3. `users`: System users with hashed passwords, PINs, active status, contact details.
4. `roles`: Role definitions (Super Admin, Owner, Manager, Accountant, Cashier, Chef, Kitchen Assistant, Storekeeper, Auditor).
5. `permissions`: Granular permission flags (e.g. `pos:create_sale`, `inventory:approve_adjustment`).
6. `user_roles`: Many-to-many user to role mapping per tenant/branch.
7. `business_settings`: Operational configurations (operating hours, currency `ZMW`, timezone `Africa/Lusaka`, tax defaults, cash tolerance).

### Menu & Recipe
8. `menu_categories`: Categories (e.g. Traditional Meals, Quick Bites, Beverages, Extras).
9. `menu_items`: Salable dishes and drinks with price, portion size, category, status.
10. `menu_prices`: Price history and variant pricing (Dine-in vs Takeaway).
11. `recipes`: Recipe header linked to menu items (name, batch quantity, target yield portions, standard cost).
12. `recipe_versions`: Version-controlled recipe revisions to protect historical batch costs.
13. `recipe_ingredients`: Bill of materials (BOM) linking raw stock items, standard quantity, and yield loss factor.

### Inventory & Stock Movements
14. `stock_categories`: Categorization (Raw Ingredients, Semi-Prepared, Finished Food, Beverages, Packaging, Cleaning).
15. `stock_locations`: Storage locations (Main Store, Kitchen Store, Bar Counter, Cold Room).
16. `stock_items`: Inventory master (name, code/SKU, category, unit of measure, reorder level, average unit cost).
17. `stock_lots`: Batch/lot records with expiry dates, initial qty, remaining qty for FEFO handling.
18. `stock_movements`: Append-only movement ledger (reference, type: RECEIPT, ISSUE, RETURN, PRODUCTION_CONSUMPTION, PRODUCTION_OUTPUT, WASTE, ADJUSTMENT, TRANSFER; source_location, dest_location, quantity, unit_cost, total_value).
19. `stock_counts`: Physical stocktake sessions with counted vs book qty, variances, and approvals.

### Daily Kitchen Production
20. `production_plans`: Daily kitchen production sheet for a specific business date.
21. `production_batches`: Actual cooking batches for menu items (planned portions, actual prepared portions, chef, status).
22. `ingredient_consumption`: Actual raw materials consumed vs standard recipe amounts.
23. `production_outputs`: Finished food portions made available to POS.
24. `production_waste`: Recorded kitchen waste (burnt, expired, dropped) with reasons.

### Procurement & Suppliers
25. `suppliers`: Vendor directory (name, contact, phone, address, payment terms).
26. `purchase_requests`: Internal store requests for items needing restocking.
27. `purchase_orders`: Formal purchase orders issued to suppliers.
28. `goods_receipts`: Received stock items verified against purchase orders.
29. `supplier_invoices`: Invoices received from suppliers for accounts payable.

### Point of Sale & Customer Credit
30. `customers`: Customer accounts (Individual and Corporate with credit eligibility, contact details, TPIN).
31. `credit_accounts`: Ledger balance, credit limit, terms, and status.
32. `orders`: Orders placed at POS (order number, table/type, status).
33. `order_items`: Line items with quantities, modifiers, line prices, tax.
34. `sales`: Finalized sale record (sale number, total amount, discount, tax, payment status, fiscal signature).
35. `sale_items`: Sold portions deducted from finished goods or direct resale stock.
36. `payments`: Payment transactions (Cash, Airtel Money, MTN MoMo, Bank Transfer, Card, Credit).
37. `payment_allocations`: Mapping payments to specific sales or invoices.
38. `credit_notes`: Reversals and approved credit adjustments.

### Invoicing & Cashier Management
39. `invoices`: Formal customer invoices (individual sale or consolidated daily/monthly credit billing).
40. `invoice_items`: Itemized line items on invoices.
41. `invoice_sale_links`: Linkage showing which specific POS sales are consolidated into an invoice.
42. `cashier_shifts`: Shift sessions (cashier, start/end time, opening float, cash sales, cash collections, cash expenses, counted cash, over/short).
43. `cash_counts`: Denomination breakdown of physical cash counted at close.

### Accounting & Auditing
44. `expense_categories`: Expense taxonomy (Rent, Utilities, Transport, Gas, Staff, Repairs).
45. `expenses`: Petty cash and direct operating expenses with approval and receipts.
46. `journal_entries`: Double-entry accounting transactions.
47. `journal_lines`: Debits and credits assigned to chart of accounts.
48. `audit_events`: Immutable security and business event audit trail (who, what, when, IP, payload diff).
49. `notifications`: Communication queue for email, WhatsApp, and SMS dispatches with status tracking.
50. `sync_commands`: Offline outbox queue records for durable client-server synchronization.
51. `sync_conflicts`: Detected synchronization collisions with resolution history.
