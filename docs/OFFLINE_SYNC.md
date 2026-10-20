# LSpot Restaurant Manager (LRM) — Offline-First Engine Specification

## 1. Offline Philosophy
Restaurant operations in Manyama, Kalumbila cannot halt when internet connectivity fluctuates. Waiters, cashiers, and kitchen supervisors must continue entering orders, processing cash payments, issuing ingredients, and recording cooking batches.

## 2. Core Principles
1. **Never Last-Write-Wins (LWW) for Financial or Stock Data**: Stock counts, cash collections, and credit limits cannot be blindly overwritten.
2. **Deterministic Append-Only Outbox**: The client writes every user action as an immutable command in local SQLite storage with an `idempotency_key` (UUID v4) and client timestamp.
3. **Conservative Offline Allocation**:
   - POS cash sales proceed offline using locally cached finished portions.
   - Offline credit sales are only permitted for pre-approved customers with cached credit headroom and within an offline ceiling.
4. **Idempotent Synchronization**: When connectivity is restored, commands are transmitted in topological dependency order. The server verifies idempotency keys to ensure duplicate network transmissions never produce duplicate orders, payments, or stock movements.
5. **Sync Conflict Resolution**: If concurrent operations exceed stock or balance headroom, the transaction is flagged in `sync_conflicts` for manager review and manual reconciliation rather than silent discard.
