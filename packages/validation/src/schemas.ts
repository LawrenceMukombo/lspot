import { z } from 'zod';
import {
  UserRole,
  UnitOfMeasure,
  StockCategoryType,
  PaymentMethod,
  CustomerType,
  DeliveryMethod
} from '@lspot/shared';

// Auth Schemas
export const LoginSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(4, 'Password must be at least 4 characters')
});

export const VerifyPinSchema = z.object({
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4 to 6 numeric digits')
});

// Restaurant Profile Schema
export const UpdateRestaurantProfileSchema = z.object({
  name: z.string().min(2),
  address: z.string().min(5),
  phone: z.string().min(5),
  email: z.string().email().optional(),
  tpin: z.string().optional(),
  currency: z.string().default('ZMW'),
  timezone: z.string().default('Africa/Lusaka'),
  cashToleranceZmw: z.number().min(0).default(5)
});

// Menu Schemas
export const CreateMenuItemSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  description: z.string().optional(),
  categoryId: z.string().uuid('Valid Category ID is required'),
  sellingPrice: z.number().positive('Selling price must be positive'),
  portionSize: z.string().min(1, 'Portion size is required (e.g., Single, Double, 1/4 Chicken)'),
  recipeId: z.string().uuid().optional(),
  isAvailable: z.boolean().default(true),
  sku: z.string().optional()
});

export const UpdateMenuItemSchema = CreateMenuItemSchema.partial();

// Recipe Schemas
export const RecipeIngredientSchema = z.object({
  stockItemId: z.string().uuid(),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitOfMeasure: z.nativeEnum(UnitOfMeasure),
  lossPercentage: z.number().min(0).max(100).default(0)
});

export const CreateRecipeSchema = z.object({
  menuItemId: z.string().uuid(),
  name: z.string().min(2),
  batchQuantity: z.number().positive(),
  expectedPortionYield: z.number().int().positive(),
  instructions: z.string().optional(),
  ingredients: z.array(RecipeIngredientSchema).min(1, 'At least one ingredient is required')
});

export const ScaleRecipeSchema = z.object({
  recipeId: z.string().uuid(),
  targetPortions: z.number().int().positive('Target portions must be a positive integer')
});

// Inventory Schemas
export const CreateStockItemSchema = z.object({
  name: z.string().min(2, 'Item name is required'),
  sku: z.string().min(2, 'SKU / Code is required'),
  category: z.nativeEnum(StockCategoryType),
  unitOfMeasure: z.nativeEnum(UnitOfMeasure),
  reorderLevel: z.number().min(0).default(5),
  initialQuantity: z.number().min(0).default(0),
  unitCost: z.number().min(0).default(0),
  locationId: z.string().uuid().optional()
});

export const StockReceiptSchema = z.object({
  stockItemId: z.string().uuid(),
  destinationLocationId: z.string().uuid(),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitCost: z.number().positive('Unit cost must be greater than zero'),
  supplierId: z.string().uuid().optional(),
  invoiceReference: z.string().optional(),
  batchLotNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  notes: z.string().optional()
});

export const StockTransferSchema = z.object({
  stockItemId: z.string().uuid(),
  sourceLocationId: z.string().uuid(),
  destinationLocationId: z.string().uuid(),
  quantity: z.number().positive('Quantity must be positive'),
  notes: z.string().optional()
});

export const StockAdjustmentSchema = z.object({
  stockItemId: z.string().uuid(),
  locationId: z.string().uuid(),
  countedQuantity: z.number().min(0),
  reason: z.string().min(5, 'Reason for adjustment is required'),
  supervisorPin: z.string().regex(/^\d{4,6}$/)
});

// Kitchen Production Schemas
export const OpenKitchenRegisterSchema = z.object({
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'),
  notes: z.string().optional()
});

export const KitchenIssueRequestSchema = z.object({
  registerId: z.string().uuid(),
  items: z.array(
    z.object({
      stockItemId: z.string().uuid(),
      requestedQuantity: z.number().positive(),
      unitOfMeasure: z.nativeEnum(UnitOfMeasure)
    })
  ).min(1),
  chefNotes: z.string().optional()
});

export const RecordProductionBatchSchema = z.object({
  registerId: z.string().uuid(),
  menuItemId: z.string().uuid(),
  plannedPortions: z.number().int().positive(),
  actualPreparedPortions: z.number().int().positive(),
  notes: z.string().optional()
});

export const RecordKitchenWasteSchema = z.object({
  registerId: z.string().uuid(),
  menuItemId: z.string().uuid(),
  portionsWasted: z.number().int().positive(),
  wasteReason: z.string().min(3),
  isStaffMeal: z.boolean().default(false),
  isComplimentary: z.boolean().default(false)
});

export const CloseKitchenRegisterSchema = z.object({
  registerId: z.string().uuid(),
  itemsClosing: z.array(
    z.object({
      menuItemId: z.string().uuid(),
      actualCountedPortions: z.number().int().min(0),
      reasonForVariance: z.string().optional()
    })
  ),
  supervisorPin: z.string().regex(/^\d{4,6}$/)
});

// POS & Sales Schemas
export const CartItemSchema = z.object({
  menuItemId: z.string().uuid(),
  portionSize: z.string(),
  unitPrice: z.number().positive(),
  quantity: z.number().int().positive(),
  notes: z.string().optional()
});

export const PosCheckoutSchema = z.object({
  idempotencyKey: z.string().uuid(),
  customerId: z.string().uuid().optional(),
  orderType: z.enum(['DINE_IN', 'TAKEAWAY']).default('DINE_IN'),
  tableNumber: z.string().optional(),
  items: z.array(CartItemSchema).min(1, 'Cart cannot be empty'),
  subtotal: z.number().positive(),
  discountAmount: z.number().min(0).default(0),
  totalAmount: z.number().positive(),
  payments: z.array(
    z.object({
      method: z.nativeEnum(PaymentMethod),
      amount: z.number().positive(),
      reference: z.string().optional(),
      notes: z.string().optional()
    })
  ).min(1, 'At least one payment entry is required')
});

// Customer Credit Schemas
export const CreateCustomerSchema = z.object({
  name: z.string().min(2, 'Customer name is required'),
  customerType: z.nativeEnum(CustomerType),
  phone: z.string().min(5, 'Valid phone number is required'),
  email: z.string().email().optional().or(z.literal('')),
  tpin: z.string().optional(),
  creditLimit: z.number().min(0).default(0),
  paymentTermsDays: z.number().int().min(0).default(30),
  address: z.string().optional()
});

export const CustomerPaymentSchema = z.object({
  customerId: z.string().uuid(),
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentMethod: z.nativeEnum(PaymentMethod),
  reference: z.string().optional(),
  notes: z.string().optional()
});

// Cashier Shift Schemas
export const OpenShiftSchema = z.object({
  openingFloat: z.number().min(0, 'Opening float cannot be negative'),
  notes: z.string().optional()
});

export const CloseShiftSchema = z.object({
  shiftId: z.string().uuid(),
  actualCashCounted: z.number().min(0),
  cashBreakdown: z.record(z.string(), z.number()).optional(),
  varianceExplanation: z.string().optional(),
  supervisorPin: z.string().regex(/^\d{4,6}$/).optional()
});

// Operating Expenses
export const CreateExpenseSchema = z.object({
  categoryId: z.string().uuid(),
  amount: z.number().positive('Amount must be positive'),
  payee: z.string().min(2, 'Payee is required'),
  description: z.string().min(3, 'Description is required'),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  receiptNumber: z.string().optional()
});

// Offline Outbox Sync Schema
export const OutboxSyncCommandSchema = z.object({
  idempotencyKey: z.string().uuid(),
  deviceId: z.string(),
  clientTimestamp: z.string(),
  commandType: z.string(),
  payload: z.any()
});

export const SyncBatchSchema = z.object({
  deviceId: z.string(),
  commands: z.array(OutboxSyncCommandSchema)
});
