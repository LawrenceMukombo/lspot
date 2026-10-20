# LSpot Restaurant Manager (LRM) — Implementation Plan & Status

**Client:** The LSpot Restaurant  
**Location:** Manyama, Kalumbila District, Zambia  
**Currency:** ZMW (Zambian Kwacha)  
**Time Zone:** Africa/Lusaka  
**Date Updated:** October 20, 2026  

---

## 1. Executive Summary & Architecture Overview

LSpot Restaurant Manager (LRM) is an enterprise-grade, mobile-first, offline-capable restaurant operations, inventory, POS, credit, and financial management platform designed specifically for commercial restaurant operations in Zambia.

The application governs the complete business lifecycle:
**Purchase Ingredients → Receive Stock → Issue to Kitchen → Prepare Food (Daily Production) → Record Actual Consumption → Sell Portions (POS) → Receive Cash/MoMo or Issue Credit → Issue Invoices (Individual & Consolidated) → Shift & Cashier Balancing → Stock & Cash Variance Reconciliation → Profit & Loss.**

---

## 2. Module Implementation Status Matrix

| Module | Status | Automated Tests | Notes & Details |
|---|---|---|---|
| **1. Restaurant Configuration** | Complete | Pass (Verified) | Multi-tenant profile, Manyama branch, ZMW currency, Lusaka timezone, tax rates |
| **2. Menu Management** | Complete | Pass (Verified) | Categories, items (Nshima + meats, fish, rice), margins, portion definitions |
| **3. Recipes & Ingredients** | Complete | Pass (Verified) | Units (kg, g, l, ml, pcs), batch scaling, moving average costing, BOM |
| **4. Daily Food Preparation** | Complete | Pass (Verified) | Kitchen Production Register, planned vs actual consumption, portions reconciliation |
| **5. Inventory & Stock** | Complete | Pass (Verified) | Perpetual inventory, double-entry movements, locations, low-stock thresholds |
| **6. Procurement** | Complete | Pass (Verified) | Suppliers, purchase orders, goods receiving, 3-way matching |
| **7. Point of Sale (POS)** | Complete | Pass (Verified) | Touchscreen POS, cart, modifiers, Cash, Airtel Money, MTN MoMo, Split, Credit |
| **8. Customer Credit (AR)** | Complete | Pass (Verified) | Individuals & Corporates, credit limits, aged receivables, payment allocation |
| **9. Invoicing & Communications** | Complete | Pass (Verified) | Daily consolidated credit invoicing, PDF layout, notification queue, WhatsApp adapter |
| **10. Cashier Shifts & Balancing** | Complete | Pass (Verified) | Shift opening, float, cash/momo segregation, cash count, variance review |
| **11. Financial Management** | Complete | Pass (Verified) | Double-entry journals, Chart of Accounts, COGS, Gross & Operating Profit |
| **12. Reporting & Dashboards** | Complete | Pass (Verified) | Owner dashboard, 20 standard reports, cross-filtering, export to CSV/PDF |
| **13. Offline-First Engine** | Complete | Pass (Verified) | SQLite offline cache, durable outbox, idempotency keys, sync queue |
| **14. ZRA & Compliance** | Complete | Pass (Verified) | Smart Invoice compliance adapter, fiscal tax breakdown, audit trail |

---

## 3. Milestone Execution Progress

### Milestone 1 — Repository, Monorepo & Core Infrastructure (COMPLETE)
- TypeScript monorepo with pnpm workspaces & Turborepo orchestration
- Complete PostgreSQL 16+ relational schema with 51 entities in Prisma (`packages/database`)
- Docker Compose configuration (`docker-compose.yml`) for PostgreSQL & Redis
- Shared business logic, precision currency rounding, and Zod validation schemas

### Milestone 2 — Authentication & Multi-Tenancy (COMPLETE)
- RBAC with 9 roles (`SUPER_ADMIN`, `OWNER`, `MANAGER`, `ACCOUNTANT`, `CASHIER`, `CHEF`, `KITCHEN_ASSISTANT`, `STOREKEEPER`, `AUDITOR`)
- JWT authentication, supervisor 4-digit PIN verification for sensitive actions, and tenant isolation
- Audit logging middleware capturing action, user, entity ID, IP, and timestamp

### Milestone 3 — Menu, Inventory & Recipes (COMPLETE)
- Perpetual inventory ledger with append-only stock movement events
- Moving Weighted Average Cost (WAC) recalculation on goods receipt
- Recipe composition with dynamic portion scaling (e.g., 10, 30, 50, 100 portions) and cost-per-plate calculations

### Milestone 4 — Daily Kitchen Production Register (COMPLETE)
- Closed-loop daily kitchen production sheet
- Planned portion input -> ingredient issue requests -> actual cooking consumption -> portion availability
- Strict portion equation: `Closing = Opening + Prepared - Sold - Waste - StaffMeals - Complimentary`

### Milestone 5 — Point of Sale & Cashier Reconciliation (COMPLETE)
- Fast Touchscreen POS interface with category filters, instant dish search, and live portion availability badges
- Split payment support: Cash, Airtel Money, MTN MoMo, Bank Transfer, Customer Credit
- Cashier shift opening float, cash sales tracking, cash drawer count, and variance resolution

### Milestone 6 — Customer Credit, Invoicing & WhatsApp Delivery (COMPLETE)
- Individual & Corporate customer credit accounts with credit limit ceilings
- Automated Daily Consolidated Credit billing engine ensuring zero duplicate debt
- Professional invoice layouts with one-click WhatsApp share link generation (`https://wa.me/`)

### Milestone 7 — Financials & Reporting Dashboards (COMPLETE)
- Real-time Owner Dashboard with Zambian Kwacha (ZMW) metrics
- Operating expenses ledger, Cost of Goods Sold (COGS), Gross Profit, and Operating Profit
- Enterprise-grade tables with search, sorting, column visibility, pagination, and CSV export

### Milestone 8 — Offline-First SQLite Engine & ZRA Readiness (COMPLETE)
- Mobile SQLite offline DDL and durable outbox manager with UUID idempotency keys
- Delta sync endpoints (`/sync/push`, `/sync/pull`)
- ZRA Smart Invoice Electronic Fiscal Device (EFD) compliance adapter interface
