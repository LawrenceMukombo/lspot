# LSpot Restaurant Manager (LRM) — Security Architecture & RBAC

## 1. Authentication & Session Management
- **Password Security**: Argon2id / bcrypt hashing with minimum cost parameters.
- **Tokens**: Short-lived JWT Access Tokens (15-60 min) with rolling refresh tokens stored securely.
- **PIN Re-authentication**: High-risk operations (approving stock adjustments, voiding sales, applying large discounts, overriding credit limits) require the manager/supervisor to enter their 4-6 digit numeric PIN.
- **Multi-Factor Authentication (MFA)**: TOTP-based MFA for administrative and owner accounts.

## 2. Role-Based Access Control (RBAC)
9 default roles configured:
1. `SUPER_ADMIN`: System-wide maintenance and tenant provisioning.
2. `OWNER`: Full financial visibility, consolidated reports, strategy, top-level approvals.
3. `MANAGER`: Operational oversight, stock approvals, credit limit overrides, shift sign-offs.
4. `ACCOUNTANT`: General ledger, accounts payable, receivables reconciliation, journal entries, tax filing.
5. `CASHIER`: POS operations, order placement, receiving payments, personal shift balancing.
6. `CHEF`: Kitchen production register, issue requests, actual consumption, portion output recording.
7. `KITCHEN_ASSISTANT`: Ingredient preparation assistance, waste logging.
8. `STOREKEEPER`: Goods receiving, storage management, stock movements, issue dispatch.
9. `AUDITOR`: Read-only access to all transactions, logs, registers, and historical ledger audits.

## 3. Tenant Isolation
- Multi-tenant architecture guarantees strict tenant scoping on every SQL query via middleware injection of `tenant_id`.
- Foreign key cascading and constraints prevent cross-tenant references.

## 4. Financial & Audit Integrity
- No physical hard-deletes of financial, inventory, or operational records.
- Soft deactivations only.
- Immutable ledger design: adjustments require balancing entries.
- Every state change triggers a structured `audit_events` log record with IP, user agent, actor ID, action name, before/after snapshot.
