# LSpot Restaurant Manager (LRM) — Test Plan

## 1. Quality Strategy
Test automation covers unit, domain logic, integration, and end-to-end flows.

## 2. Essential Test Scenarios
1. **Receive raw ingredients**: Ensure goods receipt creates positive stock movement and updates moving average cost.
2. **Issue ingredients to kitchen**: Transfer ingredients from Main Store to Kitchen Store; verify source decreases and destination increases.
3. **Record actual production consumption**: Test difference between standard recipe BOM requirement and actual consumed ingredients.
4. **Produce finished food**: Verify output batch increments finished food stock for POS.
5. **Sell prepared meals at POS**: Check atomic reduction of finished goods stock and creation of sale line items.
6. **Cash payment processing**: Ensure sale marked PAID, cash drawer balance increases.
7. **Mobile money payment processing**: Ensure payment method logged with network reference (Airtel Money / MTN MoMo).
8. **Customer credit sales**: Check credit limit validation, posting to Accounts Receivable, customer balance update.
9. **Consolidated daily credit billing**: Generate single summary invoice for all credit transactions in a business day for corporate accounts without duplicate debt.
10. **Partial repayment & allocation**: Post partial payment to customer account and allocate across oldest unpaid invoices.
11. **Kitchen food waste & leftovers**: Deduct unsold food as waste or carryover; verify closing reconciliation equation holds:
    `Closing = Opening + Prepared - Sold - Waste - StaffMeals`.
12. **Cashier shift balancing**: Cash count verification against expected cash; highlight overage/shortage.
13. **Sale void / reversal**: Test manager approval, stock return or waste logging, and ledger reversal.
14. **Offline synchronization & idempotency**: Replay offline outbox commands twice; verify server rejects duplicate processing via idempotency key.
15. **Tenant isolation**: Verify Tenant A cannot read or mutate Tenant B records.
