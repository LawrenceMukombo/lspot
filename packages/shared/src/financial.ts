import { DEFAULT_CURRENCY_SYMBOL } from './constants.js';

export function roundTo2Decimals(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export function roundQuantity(val: number): number {
  return Math.round((val + Number.EPSILON) * 10000) / 10000;
}

export function formatZMW(amount: number): string {
  const rounded = roundTo2Decimals(amount);
  return `${DEFAULT_CURRENCY_SYMBOL} ${rounded.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function calculateMovingAverageCost(
  currentQty: number,
  currentUnitCost: number,
  incomingQty: number,
  incomingUnitCost: number
): number {
  const totalQty = currentQty + incomingQty;
  if (totalQty <= 0) {
    return incomingUnitCost > 0 ? incomingUnitCost : currentUnitCost;
  }
  const currentValue = currentQty * currentUnitCost;
  const incomingValue = incomingQty * incomingUnitCost;
  return roundTo2Decimals((currentValue + incomingValue) / totalQty);
}

export interface KitchenPortionReconciliationInput {
  openingPortions: number;
  preparedPortions: number;
  soldPortions: number;
  wastePortions: number;
  staffMealPortions: number;
  complimentaryPortions: number;
  otherApprovedIssues?: number;
}

export function calculateClosingPreparedPortions(input: KitchenPortionReconciliationInput): number {
  const totalAvailable = input.openingPortions + input.preparedPortions;
  const totalConsumed =
    input.soldPortions +
    input.wastePortions +
    input.staffMealPortions +
    input.complimentaryPortions +
    (input.otherApprovedIssues || 0);

  return Math.max(0, totalAvailable - totalConsumed);
}

export interface ShiftCashReconciliationInput {
  openingFloat: number;
  cashSales: number;
  cashCreditCollections: number;
  otherCashReceipts?: number;
  cashRefunds?: number;
  approvedCashExpenses?: number;
  cashWithdrawals?: number;
  actualCashCounted: number;
}

export interface ShiftCashReconciliationResult {
  expectedClosingCash: number;
  actualCashCounted: number;
  variance: number; // positive = overage, negative = shortage
  isBalanced: boolean;
}

export function calculateShiftCashReconciliation(
  input: ShiftCashReconciliationInput
): ShiftCashReconciliationResult {
  const inflows =
    input.openingFloat +
    input.cashSales +
    input.cashCreditCollections +
    (input.otherCashReceipts || 0);

  const outflows =
    (input.cashRefunds || 0) +
    (input.approvedCashExpenses || 0) +
    (input.cashWithdrawals || 0);

  const expectedClosingCash = roundTo2Decimals(inflows - outflows);
  const actualCashCounted = roundTo2Decimals(input.actualCashCounted);
  const variance = roundTo2Decimals(actualCashCounted - expectedClosingCash);

  return {
    expectedClosingCash,
    actualCashCounted,
    variance,
    isBalanced: Math.abs(variance) < 0.01
  };
}

export function calculateGrossProfit(revenue: number, costOfGoodsSold: number): {
  grossProfit: number;
  grossMarginPercentage: number;
} {
  const grossProfit = roundTo2Decimals(revenue - costOfGoodsSold);
  const grossMarginPercentage =
    revenue > 0 ? roundTo2Decimals((grossProfit / revenue) * 100) : 0;
  return { grossProfit, grossMarginPercentage };
}

export function calculateOperatingProfit(
  grossProfit: number,
  operatingExpenses: number
): {
  operatingProfit: number;
  operatingMarginPercentage: number;
  revenue?: number;
} {
  const operatingProfit = roundTo2Decimals(grossProfit - operatingExpenses);
  return { operatingProfit, operatingMarginPercentage: 0 };
}
