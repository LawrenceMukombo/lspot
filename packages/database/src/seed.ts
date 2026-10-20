import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  DEFAULT_TENANT_ID,
  DEFAULT_BRANCH_ID,
  RESTAURANT_NAME,
  RESTAURANT_LOCATION,
  DEFAULT_CURRENCY,
  DEFAULT_TIMEZONE,
  UserRole
} from '@lspot/shared';

const prisma = new PrismaClient();

export async function seedDatabase() {
  console.log('Seeding LSpot Restaurant Manager database for Manyama, Kalumbila, Zambia...');

  // 1. Tenant & Branch
  const tenant = await prisma.tenant.upsert({
    where: { id: DEFAULT_TENANT_ID },
    update: {
      name: RESTAURANT_NAME,
      tradingName: RESTAURANT_NAME,
      country: 'Zambia',
      currency: DEFAULT_CURRENCY,
      timezone: DEFAULT_TIMEZONE
    },
    create: {
      id: DEFAULT_TENANT_ID,
      name: RESTAURANT_NAME,
      tradingName: RESTAURANT_NAME,
      country: 'Zambia',
      currency: DEFAULT_CURRENCY,
      timezone: DEFAULT_TIMEZONE,
      isActive: true
    }
  });

  const branch = await prisma.branch.upsert({
    where: { id: DEFAULT_BRANCH_ID },
    update: {
      name: 'Manyama Main Branch',
      address: RESTAURANT_LOCATION,
      phone: '+260 97 000 0000',
      isMain: true
    },
    create: {
      id: DEFAULT_BRANCH_ID,
      tenantId: tenant.id,
      name: 'Manyama Main Branch',
      code: 'MNY-01',
      address: RESTAURANT_LOCATION,
      phone: '+260 97 000 0000',
      isMain: true,
      isActive: true
    }
  });

  // Business Settings
  await prisma.businessSetting.upsert({
    where: { id: '00000000-0000-0000-0000-000000000010' },
    update: {
      operatingHoursStart: '07:00',
      operatingHoursEnd: '22:00',
      cashToleranceZmw: 5.0,
      taxRatePercent: 16.0,
      taxEnabled: false
    },
    create: {
      id: '00000000-0000-0000-0000-000000000010',
      tenantId: tenant.id,
      operatingHoursStart: '07:00',
      operatingHoursEnd: '22:00',
      cashToleranceZmw: 5.0,
      taxRatePercent: 16.0,
      taxEnabled: false,
      creditLimitCeiling: 25000.0
    }
  });

  // 2. Roles
  const roles = Object.values(UserRole);
  for (const roleCode of roles) {
    await prisma.role.upsert({
      where: { code: roleCode },
      update: { name: roleCode.replace('_', ' ') },
      create: {
        code: roleCode,
        name: roleCode.replace('_', ' '),
        description: `Role for ${roleCode}`
      }
    });
  }

  // 3. Users with secure hashed passwords
  const passwordHash = await bcrypt.hash('lspot1234', 10);
  const defaultPin = '1234';

  const defaultUsers = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      username: 'owner',
      fullName: 'Restaurant Owner',
      role: UserRole.OWNER,
      email: 'owner@lspot.zm',
      supervisorPin: defaultPin
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      username: 'manager',
      fullName: 'Mulenga Banda (Manager)',
      role: UserRole.MANAGER,
      email: 'manager@lspot.zm',
      supervisorPin: defaultPin
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      username: 'chef',
      fullName: 'Chileshe Mwewa (Head Chef)',
      role: UserRole.CHEF,
      email: 'chef@lspot.zm',
      supervisorPin: defaultPin
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      username: 'cashier1',
      fullName: 'Bupe Tembo (Cashier)',
      role: UserRole.CASHIER,
      email: 'cashier1@lspot.zm',
      supervisorPin: '0000'
    },
    {
      id: '55555555-5555-5555-5555-555555555555',
      username: 'storekeeper',
      fullName: 'Kelvin Musonda (Storekeeper)',
      role: UserRole.STOREKEEPER,
      email: 'stores@lspot.zm',
      supervisorPin: '0000'
    }
  ];

  for (const u of defaultUsers) {
    await prisma.user.upsert({
      where: { username: u.username },
      update: {
        fullName: u.fullName,
        role: u.role,
        supervisorPin: u.supervisorPin,
        isActive: true
      },
      create: {
        id: u.id,
        tenantId: tenant.id,
        branchId: branch.id,
        username: u.username,
        fullName: u.fullName,
        email: u.email,
        passwordHash,
        supervisorPin: u.supervisorPin,
        role: u.role,
        isActive: true
      }
    });
  }

  // 4. Stock Locations
  const mainStore = await prisma.stockLocation.upsert({
    where: { id: 'loc-0000-0000-0000-000000000001' },
    update: { name: 'Main Store Room', isMainStore: true },
    create: {
      id: 'loc-0000-0000-0000-000000000001',
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'Main Store Room',
      code: 'MAIN-STORE',
      isMainStore: true,
      isKitchen: false
    }
  });

  const kitchenStore = await prisma.stockLocation.upsert({
    where: { id: 'loc-0000-0000-0000-000000000002' },
    update: { name: 'Kitchen Production Area', isKitchen: true },
    create: {
      id: 'loc-0000-0000-0000-000000000002',
      tenantId: tenant.id,
      branchId: branch.id,
      name: 'Kitchen Production Area',
      code: 'KITCHEN',
      isMainStore: false,
      isKitchen: true
    }
  });

  // 5. Stock Categories & Raw Ingredients
  const rawCat = await prisma.stockCategory.upsert({
    where: { id: 'scat-0000-0000-0000-000000000001' },
    update: { name: 'Raw Ingredients' },
    create: {
      id: 'scat-0000-0000-0000-000000000001',
      tenantId: tenant.id,
      name: 'Raw Ingredients',
      code: 'RAW'
    }
  });

  const bevCat = await prisma.stockCategory.upsert({
    where: { id: 'scat-0000-0000-0000-000000000002' },
    update: { name: 'Direct Resale Beverages' },
    create: {
      id: 'scat-0000-0000-0000-000000000002',
      tenantId: tenant.id,
      name: 'Direct Resale Beverages',
      code: 'BEV'
    }
  });

  // Sample Ingredients
  const ingredientsData = [
    { id: 'ing-001', name: 'Mealie Meal (Breakfast)', sku: 'ING-MM-01', uom: 'kg', stock: 250, cost: 12.0, catId: rawCat.id },
    { id: 'ing-002', name: 'Fresh Chicken', sku: 'ING-CHK-01', uom: 'kg', stock: 80, cost: 45.0, catId: rawCat.id },
    { id: 'ing-003', name: 'Fresh Beef (Stewing)', sku: 'ING-BEEF-01', uom: 'kg', stock: 60, cost: 55.0, catId: rawCat.id },
    { id: 'ing-004', name: 'Bream Fish (Frozen)', sku: 'ING-FISH-01', uom: 'kg', stock: 50, cost: 60.0, catId: rawCat.id },
    { id: 'ing-005', name: 'Cooking Oil', sku: 'ING-OIL-01', uom: 'l', stock: 40, cost: 35.0, catId: rawCat.id },
    { id: 'ing-006', name: 'Fresh Tomatoes', sku: 'ING-TOM-01', uom: 'kg', stock: 35, cost: 18.0, catId: rawCat.id },
    { id: 'ing-007', name: 'Onions', sku: 'ING-ONION-01', uom: 'kg', stock: 30, cost: 20.0, catId: rawCat.id },
    { id: 'ing-008', name: 'Rape / Green Vegetables', sku: 'ING-VEG-01', uom: 'kg', stock: 25, cost: 15.0, catId: rawCat.id },
    { id: 'ing-009', name: 'Dry Beans', sku: 'ING-BEANS-01', uom: 'kg', stock: 40, cost: 25.0, catId: rawCat.id },
    { id: 'ing-010', name: 'Rice', sku: 'ING-RICE-01', uom: 'kg', stock: 50, cost: 22.0, catId: rawCat.id },
    { id: 'ing-011', name: 'Coca Cola 350ml Glass', sku: 'BEV-COKE-350', uom: 'pcs', stock: 120, cost: 10.0, catId: bevCat.id },
    { id: 'ing-012', name: 'Natural Mineral Water 500ml', sku: 'BEV-WATER-500', uom: 'pcs', stock: 150, cost: 5.0, catId: bevCat.id }
  ];

  for (const item of ingredientsData) {
    await prisma.stockItem.upsert({
      where: { sku: item.sku },
      update: {
        currentStock: item.stock,
        averageUnitCost: item.cost,
        totalValue: item.stock * item.cost
      },
      create: {
        id: item.id,
        tenantId: tenant.id,
        categoryId: item.catId,
        name: item.name,
        sku: item.sku,
        unitOfMeasure: item.uom,
        currentStock: item.stock,
        averageUnitCost: item.cost,
        totalValue: item.stock * item.cost,
        reorderLevel: 10.0,
        isActive: true
      }
    });
  }

  // 6. Menu Categories & Menu Items
  const tradCat = await prisma.menuCategory.upsert({
    where: { id: 'mcat-0000-0000-0000-000000000001' },
    update: { name: 'Traditional Zambian Meals' },
    create: {
      id: 'mcat-0000-0000-0000-000000000001',
      tenantId: tenant.id,
      name: 'Traditional Zambian Meals',
      description: 'Freshly prepared authentic local dishes with Nshima'
    }
  });

  const drinksCat = await prisma.menuCategory.upsert({
    where: { id: 'mcat-0000-0000-0000-000000000002' },
    update: { name: 'Cold Beverages' },
    create: {
      id: 'mcat-0000-0000-0000-000000000002',
      tenantId: tenant.id,
      name: 'Cold Beverages',
      description: 'Refreshing soft drinks and mineral water'
    }
  });

  // Menu items with standard ZMW prices
  const menuData = [
    { id: 'menu-001', name: 'Nshima with Chicken', price: 65.0, cost: 28.5, catId: tradCat.id, portion: 'Standard Portion' },
    { id: 'menu-002', name: 'Nshima with Beef', price: 70.0, cost: 32.0, catId: tradCat.id, portion: 'Standard Portion' },
    { id: 'menu-003', name: 'Nshima with Fish (Bream)', price: 75.0, cost: 36.0, catId: tradCat.id, portion: 'Whole Fish Portion' },
    { id: 'menu-004', name: 'Nshima with Beans & Veg', price: 40.0, cost: 14.0, catId: tradCat.id, portion: 'Standard Portion' },
    { id: 'menu-005', name: 'Rice with Chicken', price: 65.0, cost: 29.0, catId: tradCat.id, portion: 'Standard Portion' },
    { id: 'menu-006', name: 'Soft Drink (Coca Cola 350ml)', price: 15.0, cost: 10.0, catId: drinksCat.id, portion: 'Bottle' },
    { id: 'menu-007', name: 'Bottled Mineral Water 500ml', price: 10.0, cost: 5.0, catId: drinksCat.id, portion: 'Bottle' }
  ];

  for (const m of menuData) {
    await prisma.menuItem.upsert({
      where: { id: m.id },
      update: {
        sellingPrice: m.price,
        estimatedCost: m.cost,
        isAvailable: true
      },
      create: {
        id: m.id,
        tenantId: tenant.id,
        branchId: branch.id,
        categoryId: m.catId,
        name: m.name,
        sellingPrice: m.price,
        estimatedCost: m.cost,
        portionSize: m.portion,
        isAvailable: true
      }
    });
  }

  // 7. Customers & Credit Accounts
  const sampleCustomers = [
    {
      id: 'cust-001',
      name: 'Kalumbila Mining Services Ltd',
      customerType: 'CORPORATE',
      phone: '+260 97 111 2233',
      email: 'procurement@kalumbilamining.zm',
      tpin: '1002345678',
      creditLimit: 15000.0,
      currentBalance: 3250.0,
      paymentTermsDays: 30
    },
    {
      id: 'cust-002',
      name: 'Manyama Transport & Logistics',
      customerType: 'CORPORATE',
      phone: '+260 96 444 5566',
      email: 'accounts@manyamatransport.zm',
      creditLimit: 8000.0,
      currentBalance: 1450.0,
      paymentTermsDays: 14
    },
    {
      id: 'cust-003',
      name: 'Dr. Mwape Kangwa',
      customerType: 'INDIVIDUAL',
      phone: '+260 97 777 8899',
      creditLimit: 2000.0,
      currentBalance: 420.0,
      paymentTermsDays: 7
    }
  ];

  for (const c of sampleCustomers) {
    await prisma.customer.upsert({
      where: { id: c.id },
      update: {
        creditLimit: c.creditLimit,
        currentBalance: c.currentBalance
      },
      create: {
        id: c.id,
        tenantId: tenant.id,
        name: c.name,
        customerType: c.customerType,
        phone: c.phone,
        email: c.email,
        tpin: c.tpin,
        creditLimit: c.creditLimit,
        currentBalance: c.currentBalance,
        paymentTermsDays: c.paymentTermsDays,
        isActive: true
      }
    });
  }

  // 8. Expense Categories
  const expenseCategories = [
    { id: 'exp-001', code: 'UTILITIES', name: 'Utilities & ZESCO Power' },
    { id: 'exp-002', code: 'GAS', name: 'Cooking Gas (LPG)' },
    { id: 'exp-003', code: 'LOGISTICS', name: 'Fresh Produce Transport & Delivery' },
    { id: 'exp-004', code: 'SUPPLIES', name: 'Cleaning & Kitchen Consumables' },
    { id: 'exp-005', code: 'REPAIRS', name: 'Equipment Maintenance' }
  ];

  for (const exp of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { id: exp.id },
      update: { name: exp.name },
      create: {
        id: exp.id,
        tenantId: tenant.id,
        code: exp.code,
        name: exp.name
      }
    });
  }

  console.log('Seeding completed successfully!');
}

if (process.argv[1]?.includes('seed.ts') || process.argv[1]?.includes('seed.js')) {
  seedDatabase()
    .catch((e) => {
      console.error('Error during seeding:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
