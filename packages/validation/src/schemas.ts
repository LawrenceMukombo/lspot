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
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  categoryId: z.string().min(1, 'Category is required'),
  sellingPrice: z.number().positive('Selling price must be positive'),
  estimatedCost: z.number().min(0).optional(),
  portionSize: z.string().min(1, 'Portion size is required (e.g., Single, Double, 1/4 Chicken)'),
  recipeId: z.string().min(1).optional().nullable(),
  isAvailable: z.boolean().default(true),
  sku: z.string().optional().nullable()
});

export const UpdateMenuItemSchema = CreateMenuItemSchema.partial();

// Recipe Schemas
export const RecipeIngredientSchema = z.object({
  stockItemId: z.string().min(1),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitOfMeasure: z.nativeEnum(UnitOfMeasure),
  lossPercentage: z.number().min(0).max(100).default(0)
});

export const CreateRecipeSchema = z.object({
  menuItemId: z.string().min(1),
  name: z.string().min(2),
  batchQuantity: z.number().positive(),
  expectedPortionYield: z.number().int().positive(),
  instructions: z.string().optional().nullable(),
  ingredients: z.array(RecipeIngredientSchema).min(1, 'At least one ingredient is required')
});

export const ScaleRecipeSchema = z.object({
  recipeId: z.string().min(1),
  targetPortions: z.number().int().positive('Target portions must be a positive integer')
});

// Inventory Schemas
export const CreateStockItemSchema = z.object({
  name: z.string().min(2, 'Item name is required'),
  sku: z.string().min(2, 'SKU / Code is required'),
  category: z.union([z.nativeEnum(StockCategoryType), z.string()]).optional(),
  categoryId: z.string().min(1).optional().nullable(),
  unitOfMeasure: z.nativeEnum(UnitOfMeasure),
  reorderLevel: z.number().min(0).default(5),
  initialQuantity: z.number().min(0).default(0),
  currentStock: z.number().min(0).optional(),
  unitCost: z.number().min(0).default(0),
  averageUnitCost: z.number().min(0).optional(),
  barcode: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  locationId: z.string().min(1).optional().nullable()
});

export const UpdateStockItemSchema = CreateStockItemSchema.partial();

export const StockReceiptSchema = z.object({
  stockItemId: z.string().min(1),
  destinationLocationId: z.string().min(1).optional().nullable(),
  quantity: z.number().positive('Quantity must be greater than zero'),
  unitCost: z.number().positive('Unit cost must be greater than zero'),
  supplierId: z.string().min(1).optional().nullable(),
  invoiceReference: z.string().optional().nullable(),
  batchLotNumber: z.string().optional().nullable(),
  expiryDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

export const StockTransferSchema = z.object({
  stockItemId: z.string().min(1),
  sourceLocationId: z.string().min(1),
  destinationLocationId: z.string().min(1),
  quantity: z.number().positive('Quantity must be positive'),
  notes: z.string().optional().nullable()
});

export const StockAdjustmentSchema = z.object({
  stockItemId: z.string().min(1),
  locationId: z.string().min(1).optional().nullable(),
  countedQuantity: z.number().min(0),
  reason: z.string().min(3, 'Reason for adjustment is required'),
  supervisorPin: z.string().regex(/^\d{4,6}$/)
});

// Kitchen Production Schemas
export const OpenKitchenRegisterSchema = z.object({
  businessDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date format must be YYYY-MM-DD'),
  notes: z.string().optional().nullable()
});

export const KitchenIssueRequestSchema = z.object({
  registerId: z.string().min(1),
  items: z.array(
    z.object({
      stockItemId: z.string().min(1),
      requestedQuantity: z.number().positive(),
      unitOfMeasure: z.nativeEnum(UnitOfMeasure)
    })
  ).min(1),
  chefNotes: z.string().optional().nullable()
});

export const RecordProductionBatchSchema = z.object({
  registerId: z.string().min(1),
  menuItemId: z.string().min(1),
  plannedPortions: z.number().int().positive(),
  actualPreparedPortions: z.number().int().positive(),
  notes: z.string().optional().nullable()
});

export const RecordKitchenWasteSchema = z.object({
  registerId: z.string().min(1),
  menuItemId: z.string().min(1),
  portionsWasted: z.number().int().positive(),
  wasteReason: z.string().min(3),
  isStaffMeal: z.boolean().default(false),
  isComplimentary: z.boolean().default(false)
});

export const CloseKitchenRegisterSchema = z.object({
  registerId: z.string().min(1),
  itemsClosing: z.array(
    z.object({
      menuItemId: z.string().min(1),
      actualCountedPortions: z.number().int().min(0),
      reasonForVariance: z.string().optional().nullable()
    })
  ),
  supervisorPin: z.string().regex(/^\d{4,6}$/)
});

// POS & Sales Schemas
export const CartItemSchema = z.object({
  menuItemId: z.string().min(1),
  portionSize: z.string().optional().default('Standard Portion'),
  unitPrice: z.number().positive(),
  quantity: z.number().int().positive(),
  subtotal: z.number().optional(),
  notes: z.string().optional().nullable()
});

export const PosCheckoutSchema = z.object({
  idempotencyKey: z.string().min(1),
  customerId: z.string().optional().nullable(),
  orderType: z.enum(['DINE_IN', 'TAKEAWAY']).default('DINE_IN'),
  tableNumber: z.string().optional().nullable(),
  items: z.array(CartItemSchema).min(1, 'Cart cannot be empty'),
  subtotal: z.number().positive(),
  discountAmount: z.number().min(0).default(0),
  totalAmount: z.number().positive(),
  payments: z.array(
    z.object({
      method: z.nativeEnum(PaymentMethod),
      amount: z.number().positive(),
      reference: z.string().optional().nullable(),
      notes: z.string().optional().nullable()
    })
  ).min(1, 'At least one payment entry is required')
});

// Customer Credit Schemas
export const CreateCustomerSchema = z.object({
  name: z.string().min(2, 'Customer name is required'),
  customerType: z.nativeEnum(CustomerType),
  phone: z.string().min(5, 'Valid phone number is required'),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  tpin: z.string().optional().nullable(),
  creditLimit: z.number().min(0).default(0),
  currentBalance: z.number().min(0).optional(),
  paymentTermsDays: z.number().int().min(0).default(30),
  address: z.string().optional().nullable(),
  isActive: z.boolean().optional()
});

export const UpdateCustomerSchema = CreateCustomerSchema.partial();

export const CustomerPaymentSchema = z.object({
  customerId: z.string().min(1),
  amount: z.number().positive('Payment amount must be greater than zero'),
  paymentMethod: z.nativeEnum(PaymentMethod),
  reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

// Cashier Shift Schemas
export const OpenShiftSchema = z.object({
  openingFloat: z.number().min(0, 'Opening float cannot be negative'),
  notes: z.string().optional().nullable()
});

export const CloseShiftSchema = z.object({
  shiftId: z.string().min(1),
  actualCashCounted: z.number().min(0),
  cashBreakdown: z.record(z.string(), z.number()).optional(),
  varianceExplanation: z.string().optional().nullable(),
  supervisorPin: z.string().regex(/^\d{4,6}$/).optional()
});

// Operating Expenses
export const CreateExpenseSchema = z.object({
  categoryId: z.string().min(1),
  amount: z.number().positive('Amount must be positive'),
  payee: z.string().min(2, 'Payee is required'),
  description: z.string().min(3, 'Description is required'),
  paymentMethod: z.nativeEnum(PaymentMethod).default(PaymentMethod.CASH),
  receiptNumber: z.string().optional().nullable(),
  expenseDate: z.string().optional().nullable()
});

export const UpdateExpenseSchema = CreateExpenseSchema.partial();

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
