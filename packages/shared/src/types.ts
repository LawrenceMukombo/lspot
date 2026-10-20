import {
  UserRole,
  PaymentMethod,
  SaleStatus,
  StockMovementType,
  InvoiceStatus,
  CustomerType,
  ShiftStatus
} from './enums.js';

export interface BaseEntity {
  id: string;
  tenantId: string;
  branchId: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSession {
  id: string;
  tenantId: string;
  branchId: string;
  username: string;
  fullName: string;
  role: UserRole;
  permissions: string[];
}

export interface MenuItemDTO {
  id: string;
  name: string;
  description?: string;
  categoryId: string;
  categoryName?: string;
  sellingPrice: number;
  portionSize: string;
  estimatedCost: number;
  recipeId?: string;
  isAvailable: boolean;
  status: string;
}

export interface StockItemDTO {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  unitCost: number;
  totalValue: number;
}

export interface KitchenRegisterItemDTO {
  id: string;
  menuItemId: string;
  menuItemName: string;
  portionSize: string;
  openingPortions: number;
  preparedPortions: number;
  soldPortions: number;
  wastePortions: number;
  staffMealPortions: number;
  complimentaryPortions: number;
  remainingPortions: number;
  closingPortions: number;
}

export interface CartItemDTO {
  menuItemId: string;
  name: string;
  portionSize: string;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  notes?: string;
}

export interface CustomerCreditDTO {
  id: string;
  name: string;
  customerType: CustomerType;
  phone: string;
  email?: string;
  tpin?: string;
  creditLimit: number;
  currentBalance: number;
  availableCredit: number;
  paymentTermsDays: number;
  status: string;
}

export interface ShiftSummaryDTO {
  id: string;
  cashierId: string;
  cashierName: string;
  status: ShiftStatus;
  startedAt: string;
  closedAt?: string;
  openingFloat: number;
  cashSales: number;
  cashCreditCollections: number;
  cashExpenses: number;
  expectedCash: number;
  actualCashCounted?: number;
  variance?: number;
}

export interface DailyExecutiveSummaryDTO {
  date: string;
  todaySales: number;
  cashReceived: number;
  mobileMoneyReceived: number;
  creditSales: number;
  creditCollections: number;
  outstandingDebtors: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingProfit: number;
  wasteValue: number;
  inventoryValue: number;
  lowStockItemsCount: number;
  totalPortionsPrepared: number;
  totalPortionsSold: number;
}
