# LSpot Restaurant Manager (LRM) — Architecture Specification

## 1. Architectural Philosophy
LRM is engineered as a **Modular Monolith** using a TypeScript monorepo. This eliminates premature microservice complexity while guaranteeing rigorous domain boundaries, strong type safety, and clear separation of concerns across operational domains.

```
                    ┌──────────────────────────────────────────────┐
                    │               Client Layer                   │
                    │  ┌────────────────────┐ ┌──────────────────┐ │
                    │  │  Web Admin & POS   │ │   Mobile POS &   │ │
                    │  │    (Next.js /      │ │ Kitchen App      │ │
                    │  │   Vite + React)    │ │ (React Native /  │ │
                    │  │                    │ │ Expo + SQLite)   │ │
                    │  └──────────┬─────────┘ └────────┬─────────┘ │
                    └─────────────┼────────────────────┼───────────┘
                                  │ HTTPS/WSS (REST)   │ Sync Engine
                                  ▼                    ▼
                    ┌──────────────────────────────────────────────┐
                    │            API Application Layer             │
                    │                  (NestJS)                    │
                    │  ┌────────────────────────────────────────┐  │
                    │  │ Global Middleware: Auth, RBAC, Tenancy │  │
                    │  └───────────────────┬────────────────────┘  │
                    │                      ▼                       │
                    │  ┌────────────────────────────────────────┐  │
                    │  │  Operational Domain Modules:           │  │
                    │  │  - Identity & Access (RBAC)            │  │
                    │  │  - Restaurant & Branch Config          │  │
                    │  │  - Menu & Pricing Catalog              │  │
                    │  │  - Inventory & Stock Movements         │  │
                    │  │  - Recipe & Costing Engine             │  │
                    │  │  - Daily Kitchen Production Register   │  │
                    │  │  - Point of Sale & Checkout            │  │
                    │  │  - Customer Credit & Receivables       │  │
                    │  │  - Invoicing & PDF Engine              │  │
                    │  │  - Cashier Shift & Drawer Balancing    │  │
                    │  │  - General Ledger & Accounting         │  │
                    │  │  - Analytics & Reports Engine          │  │
                    │  │  - Offline Outbox Sync Engine          │  │
                    │  │  - ZRA Smart Invoice Compliance        │  │
                    │  └───────────────────┬────────────────────┘  │
                    │                      ▼                       │
                    │  ┌────────────────────────────────────────┐  │
                    │  │ Shared Infrastructure:                 │  │
                    │  │ - Transactional Outbox                 │  │
                    │  │ - Event Bus / Notification Dispatch    │  │
                    │  │ - Audit Logging Interceptor            │  │
                    │  └───────────────────┬────────────────────┘  │
                    └──────────────────────┼───────────────────────┘
                                           │
                                           ▼
                    ┌──────────────────────────────────────────────┐
                    │               Persistence Layer              │
                    │  ┌────────────────────┐ ┌──────────────────┐ │
                    │  │     PostgreSQL     │ │   Redis Cache    │ │
                    │  │ (Relational Data & │ │   & Background   │ │
                    │  │ Perpetual Ledgers) │ │   Task Queues    │ │
                    │  └────────────────────┘ └──────────────────┘ │
                    └──────────────────────────────────────────────┘
```

## 2. Directory & Package Structure
```
c:/lrm/
├── apps/
│   ├── api/          # NestJS backend application with modular domain architecture
│   ├── web/          # Next.js / React enterprise web management & POS application
│   └── mobile/       # React Native / Expo mobile application with SQLite offline cache
├── packages/
│   ├── database/     # Prisma / Drizzle models, schema migrations, and seed scripts
│   ├── shared/       # Cross-tier TypeScript types, DTOs, interfaces, and ZMW currency utils
│   └── validation/   # Zod validation schemas for all requests and commands
├── infrastructure/
│   ├── docker/       # Dockerfile, docker-compose.yml for dev & production
│   └── nginx/        # Nginx reverse proxy configuration
├── docs/             # Technical specifications, plans, and API documentation
├── pnpm-workspace.yaml
├── package.json
└── turbo.json
```

## 3. Core Domain Design
1. **Multi-Tenant & Multi-Branch**:
   - Every operational entity contains `tenant_id` and `branch_id`.
   - Default tenant: The LSpot Restaurant; default branch: Manyama Main Branch.
2. **Double-Entry Ledgers**:
   - Stock: Every stock movement has a source, destination, and event type. No unrecorded qty changes.
   - Financials: Sales, collections, and expenses post balanced debits and credits to the general ledger.
3. **Daily Food Production Loop**:
   - Closed loop: Opening -> Production Planned -> Ingredients Issued -> Actual Consumed -> Portions Produced -> Portions Sold (POS) -> Waste/Staff Meals -> Portions Left -> Closing.
4. **Offline First**:
   - Durable client-side outbox with UUIDs and client-generated timestamps.
   - Idempotent API processing ensuring network retries cannot duplicate transactions.
