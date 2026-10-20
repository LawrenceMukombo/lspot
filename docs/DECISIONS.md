# LSpot Restaurant Manager (LRM) — Architectural & Technical Decisions

## ADR 1: Monorepo Architecture with pnpm Workspaces
- **Context**: The system requires shared data contracts, validation schemas, and database types between Backend API, Web Management, and Mobile POS.
- **Decision**: Use a TypeScript monorepo with pnpm workspaces.
- **Rationale**: Guarantees compile-time synchronization of API contracts, eliminates drift between frontend and backend models, and simplifies repository management.

## ADR 2: PostgreSQL as Primary Datastore with Prisma ORM
- **Context**: Restaurant operations require strict ACID compliance, transactional integrity for stock and money, relational foreign keys, and complex aggregation queries.
- **Decision**: PostgreSQL 16+ as the primary transactional datastore, with Prisma ORM for type-safe database queries and migrations.
- **Rationale**: Ensures zero phantom data anomalies during high-concurrency lunch rushes, strict decimal precision for ZMW currency, and robust schema migrations.

## ADR 3: Append-Only Stock Movements & Double-Entry Accounting
- **Context**: Inventory loss, kitchen shrinkage, and unexplained cash variances are major risks in food & beverage operations.
- **Decision**: Never perform an in-place `UPDATE stock SET quantity = quantity - x` without an accompanying immutable `stock_movements` record. Every monetary transaction generates double-entry general ledger journal entries.
- **Rationale**: Complete auditability allows the restaurant owner to inspect every single gram of mealie meal, chicken, or cooking oil from receipt to finished plate.

## ADR 4: ZRA Smart Invoice Compliance Readiness
- **Context**: Zambia Revenue Authority requires Electronic Fiscal Devices / Smart Invoice integration for formal business transactions.
- **Decision**: Implement a decoupled `FiscalIntegrationService` adapter interface that produces compliant payload structures, handles fiscal signatures, and stores verification counters without blocking core offline operations.
