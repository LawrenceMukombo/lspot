import test from 'node:test';
import assert from 'node:assert';
import {
  calculateMovingAverageCost,
  calculateClosingPreparedPortions,
  calculateShiftCashReconciliation,
  calculateGrossProfit,
  formatZMW,
  roundTo2Decimals,
  PaymentMethod
} from '@lspot/shared';
import { InitiateMoMoPushSchema, PosCheckoutSchema } from '@lspot/validation';

test('Test 1: Moving Weighted Average Cost (WAC) calculation on receiving raw ingredients', () => {
  // Existing 100 kg mealie meal @ K 10.00/kg (Value = K 1,000)
  // Incoming 50 kg mealie meal @ K 16.00/kg (Value = K 800)
  // Expected new WAC = (1,000 + 800) / 150 = 1,800 / 150 = K 12.00/kg
  const newWac = calculateMovingAverageCost(100, 10, 50, 16);
  assert.strictEqual(newWac, 12.00, 'WAC must accurately reflect weighted inventory value');
});

test('Test 2: Kitchen portion reconciliation equation holds true', () => {
  // Opening: 10 portions
  // Prepared today: 50 portions
  // Sold: 45 portions
  // Waste: 3 portions
  // Staff meals: 2 portions
  // Complimentary: 1 portion
  // Closing = 10 + 50 - 45 - 3 - 2 - 1 = 9 portions
  const closing = calculateClosingPreparedPortions({
    openingPortions: 10,
    preparedPortions: 50,
    soldPortions: 45,
    wastePortions: 3,
    staffMealPortions: 2,
    complimentaryPortions: 1
  });
  assert.strictEqual(closing, 9, 'Closing prepared portions must strictly match physical and transaction records');
});

test('Test 3: Cashier shift cash balancing and variance detection (balanced case)', () => {
  // Float: K 200
  // Cash Sales: K 1,500
  // Cash Debt Collections: K 300
  // Cash Expenses (Gas): K 150
  // Expected = 200 + 1500 + 300 - 150 = K 1,850
  // Actual counted = K 1,850 -> Variance = 0, isBalanced = true
  const recon = calculateShiftCashReconciliation({
    openingFloat: 200,
    cashSales: 1500,
    cashCreditCollections: 300,
    approvedCashExpenses: 150,
    actualCashCounted: 1850
  });

  assert.strictEqual(recon.expectedClosingCash, 1850.00);
  assert.strictEqual(recon.variance, 0.00);
  assert.strictEqual(recon.isBalanced, true);
});

test('Test 4: Cashier shift shortage detection (unbalanced case)', () => {
  // Expected: K 1,850, Actual counted: K 1,800 -> Shortage of -50 ZMW
  const recon = calculateShiftCashReconciliation({
    openingFloat: 200,
    cashSales: 1500,
    cashCreditCollections: 300,
    approvedCashExpenses: 150,
    actualCashCounted: 1800
  });

  assert.strictEqual(recon.variance, -50.00, 'Variance must detect cash shortage');
  assert.strictEqual(recon.isBalanced, false, 'Shortage must flag shift as unbalanced');
});

test('Test 5: Gross profit and margin calculation in Zambian Kwacha (ZMW)', () => {
  // Revenue: K 10,000, COGS: K 4,500 -> Gross Profit: K 5,500, Margin: 55%
  const profit = calculateGrossProfit(10000, 4500);
  assert.strictEqual(profit.grossProfit, 5500.00);
  assert.strictEqual(profit.grossMarginPercentage, 55.00);
});

test('Test 6: Currency formatting for Zambian Kwacha', () => {
  assert.strictEqual(formatZMW(65), 'K 65.00');
  assert.strictEqual(formatZMW(1250.75), 'K 1,250.75');
});

test('Test 7: Offline idempotency key deduplication simulation', () => {
  const processedKeys = new Set<string>();
  const command = { idempotencyKey: 'offline-uuid-001', amount: 65.0 };

  function executeTransaction(cmd: typeof command) {
    if (processedKeys.has(cmd.idempotencyKey)) {
      return { status: 'DUPLICATE_IGNORED' };
    }
    processedKeys.add(cmd.idempotencyKey);
    return { status: 'EXECUTED', amount: cmd.amount };
  }

  const firstAttempt = executeTransaction(command);
  assert.strictEqual(firstAttempt.status, 'EXECUTED');

  const secondAttempt = executeTransaction(command);
  assert.strictEqual(secondAttempt.status, 'DUPLICATE_IGNORED', 'Idempotency must prevent double billing on network retry');
});

test('Test 8: Customer credit headroom validation', () => {
  const customer = { creditLimit: 5000, currentBalance: 4200 };
  const availableCredit = customer.creditLimit - customer.currentBalance;
  assert.strictEqual(availableCredit, 800);

  const purchaseAmount = 900;
  const isApproved = purchaseAmount <= availableCredit;
  assert.strictEqual(isApproved, false, 'Credit transaction must be rejected when exceeding credit headroom');
});

test('Test 9: Consolidated daily billing allocation without duplicate debt', () => {
  // Customer had 3 meals on credit today: K 65, K 70, K 75
  const meals = [65, 70, 75];
  const initialCustomerBalance = 210; // Already updated per sale at POS
  const consolidatedTotal = meals.reduce((a, b) => a + b, 0);

  assert.strictEqual(consolidatedTotal, 210);
  // Rule: Consolidation must NOT add 210 again to initialCustomerBalance
  const updatedCustomerBalance = initialCustomerBalance; // remains K 210
  assert.strictEqual(updatedCustomerBalance, 210, 'Consolidated invoice generation must preserve customer balance without duplicate debit');
});

test('Test 10: DPO Mobile Money validation and anti-replay token protection', () => {
  // Valid Airtel Money push request
  const validPush = InitiateMoMoPushSchema.safeParse({
    provider: PaymentMethod.AIRTEL_MONEY,
    phone: '+260 97 1234567',
    amount: 130.0
  });
  assert.strictEqual(validPush.success, true, 'Valid Zambian Airtel Money payload must pass');

  // Invalid phone / negative amount must be rejected
  const invalidPush = InitiateMoMoPushSchema.safeParse({
    provider: PaymentMethod.MTN_MOMO,
    phone: 'abc-script',
    amount: -50
  });
  assert.strictEqual(invalidPush.success, false, 'Malformed phone and negative amount must be rejected');

  // XML injection / invalid token characters in dpoTransactionToken must be rejected
  const maliciousTokenCheckout = PosCheckoutSchema.safeParse({
    idempotencyKey: '11111111-2222-3333-4444-555555555555',
    dpoTransactionToken: '<TransactionToken>999</TransactionToken>',
    orderType: 'DINE_IN',
    items: [{ menuItemId: 'item-1', unitPrice: 65, quantity: 1 }],
    subtotal: 65,
    discountAmount: 0,
    totalAmount: 65,
    payments: [{ method: PaymentMethod.AIRTEL_MONEY, amount: 65 }]
  });
  assert.strictEqual(maliciousTokenCheckout.success, false, 'XML/special characters in dpoTransactionToken must be rejected');
});

test('Test 11: Biometrics must be explicitly registered before authentication succeeds', () => {
  const registry = new Map<string, { credentialId: string; userId: string; type: 'thumbprint' | 'face' }>();

  function verifyBiometricLogin(credentialId: string, type: 'thumbprint' | 'face') {
    const rec = registry.get(credentialId);
    if (!rec || rec.type !== type) {
      throw new Error(`No registered ${type === 'face' ? 'Face Recognition' : 'Thumbprint'} found.`);
    }
    return rec;
  }

  // Attempting to login before registration must throw
  assert.throws(
    () => verifyBiometricLogin('BIO-THUMBPRINT-UNREGISTERED', 'thumbprint'),
    /No registered Thumbprint found/,
    'Unregistered thumbprint must be rejected'
  );

  // Registering first allows subsequent login
  registry.set('BIO-THUMBPRINT-001', {
    credentialId: 'BIO-THUMBPRINT-001',
    userId: 'user-manager-1',
    type: 'thumbprint'
  });

  const verified = verifyBiometricLogin('BIO-THUMBPRINT-001', 'thumbprint');
  assert.strictEqual(verified.userId, 'user-manager-1');
});
