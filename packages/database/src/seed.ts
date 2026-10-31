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
  const defaultUsers = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      username: 'superadmin',
      fullName: 'Lawrence Mukombo (Super Admin)',
      role: UserRole.SUPER_ADMIN,
      email: 'admin@lamtoninvestments.com',
      passwordPlain: process.env.SUPER_ADMIN_PASSWORD || 'LSpot@Admin2026!',
      supervisorPin: process.env.SUPER_ADMIN_PIN || '8899'
    },
    {
      id: '11111111-1111-1111-1111-111111111111',
      username: 'owner',
      fullName: 'Executive Owner',
      role: UserRole.OWNER,
      email: 'owner@lspot.zm',
      passwordPlain: process.env.OWNER_PASSWORD || 'LSpot@Owner2026!',
      supervisorPin: process.env.OWNER_PIN || '9999'
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      username: 'manager',
      fullName: 'Mulenga Banda (Manager)',
      role: UserRole.MANAGER,
      email: 'manager@lspot.zm',
      passwordPlain: process.env.MANAGER_PASSWORD || 'LSpot@Manager2026!',
      supervisorPin: process.env.MANAGER_PIN || '1234'
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      username: 'chef',
      fullName: 'Chileshe Mwewa (Head Chef)',
      role: UserRole.CHEF,
      email: 'chef@lspot.zm',
      passwordPlain: 'LSpot@Chef2026!',
      supervisorPin: '3344'
    },
    {
      id: '44444444-4444-4444-4444-444444444444',
      username: 'cashier1',
      fullName: 'Bupe Tembo (Cashier)',
      role: UserRole.CASHIER,
      email: 'cashier1@lspot.zm',
      passwordPlain: 'LSpot@Cash2026!',
      supervisorPin: '2222'
    },
    {
      id: '55555555-5555-5555-5555-555555555555',
      username: 'storekeeper',
      fullName: 'Kelvin Musonda (Storekeeper)',
      role: UserRole.STOREKEEPER,
      email: 'stores@lspot.zm',
      passwordPlain: 'LSpot@Store2026!',
      supervisorPin: '5566'
    }
  ];

  for (const u of defaultUsers) {
    const passwordHash = await bcrypt.hash(u.passwordPlain, 10);
    await prisma.user.upsert({
      where: { username: u.username },
      update: {
        fullName: u.fullName,
        role: u.role,
        passwordHash,
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

  // Menu items with standard ZMW prices, descriptions and food photography
  const menuData = [
    {
      id: 'menu-001',
      name: 'Nshima with Chicken',
      description: 'Authentic steaming white nshima served with tender stewed village chicken in rich tomato and onion gravy with fresh greens',
      price: 65.0,
      cost: 28.5,
      catId: tradCat.id,
      portion: 'Standard Portion',
      imageUrl: '/images/food/nshima_chicken.jpg'
    },
    {
      id: 'menu-002',
      name: 'Nshima with Beef',
      description: 'Hearty slow-braised beef stew with thick savory gravy, accompanied by hot white nshima and stir-fried rape greens',
      price: 70.0,
      cost: 32.0,
      catId: tradCat.id,
      portion: 'Standard Portion',
      imageUrl: '/images/food/nshima_beef.jpg'
    },
    {
      id: 'menu-003',
      name: 'Nshima with Fish (Bream)',
      description: 'Whole crispy golden fried Kariba bream fish garnished with fresh lemon, served with white nshima and seasoned tomato relish',
      price: 75.0,
      cost: 36.0,
      catId: tradCat.id,
      portion: 'Whole Fish Portion',
      imageUrl: '/images/food/nshima_fish.jpg'
    },
    {
      id: 'menu-004',
      name: 'Nshima with Beans & Veg',
      description: 'Slow-cooked Zambian red sugar beans in rich tomato gravy, served with fluffy nshima and steamed green vegetables',
      price: 40.0,
      cost: 14.0,
      catId: tradCat.id,
      portion: 'Standard Portion',
      imageUrl: '/images/food/nshima_beans.jpg'
    },
    {
      id: 'menu-005',
      name: 'Rice with Chicken',
      description: 'Fragrant steamed long-grain rice served with succulent seasoned roasted chicken, savory gravy, and crisp garden salad',
      price: 65.0,
      cost: 29.0,
      catId: tradCat.id,
      portion: 'Standard Portion',
      imageUrl: '/images/food/rice_chicken.jpg'
    },
    {
      id: 'menu-006',
      name: 'Soft Drink (Coca Cola 350ml)',
      description: 'Chilled 350ml glass bottle of Coca-Cola served ice-cold with classic effervescence',
      price: 15.0,
      cost: 10.0,
      catId: drinksCat.id,
      portion: 'Bottle',
      imageUrl: '/images/food/coke_bottle.jpg'
    },
    {
      id: 'menu-007',
      name: 'Bottled Mineral Water 500ml',
      description: 'Pure, refreshing chilled natural mineral water in a 500ml bottle',
      price: 10.0,
      cost: 5.0,
      catId: drinksCat.id,
      portion: 'Bottle',
      imageUrl: '/images/food/bottled_water.jpg'
    }
  ];

  for (const m of menuData) {
    await prisma.menuItem.upsert({
      where: { id: m.id },
      update: {
        name: m.name,
        description: m.description,
        sellingPrice: m.price,
        estimatedCost: m.cost,
        imageUrl: m.imageUrl,
        portionSize: m.portion,
        isAvailable: true
      },
      create: {
        id: m.id,
        tenantId: tenant.id,
        branchId: branch.id,
        categoryId: m.catId,
        name: m.name,
        description: m.description,
        sellingPrice: m.price,
        estimatedCost: m.cost,
        imageUrl: m.imageUrl,
        portionSize: m.portion,
        isAvailable: true
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

  // Optional demo transactions (disabled by default in production)
  if (process.env.SEED_DEMO_TRANSACTIONS === 'true') {
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

    // 9. Realistic Daily Expenses
  const todayDate = new Date();
  const sampleExpenses = [
    {
      id: 'exp-rec-001',
      categoryId: 'exp-001',
      amount: 350.0,
      payee: 'ZESCO Prepaid Power Token',
      description: 'Kitchen 3-phase electricity units recharge',
      paymentMethod: 'CASH'
    },
    {
      id: 'exp-rec-002',
      categoryId: 'exp-002',
      amount: 450.0,
      payee: 'Afrox Gas Kalumbila',
      description: '48kg Commercial LPG cylinder exchange for cookers',
      paymentMethod: 'CASH'
    },
    {
      id: 'exp-rec-003',
      categoryId: 'exp-003',
      amount: 220.0,
      payee: 'Solwezi Fresh Produce Courier',
      description: 'Morning delivery of fresh vegetables, rape greens & tomatoes',
      paymentMethod: 'AIRTEL_MONEY'
    }
  ];

  for (const er of sampleExpenses) {
    await prisma.expense.upsert({
      where: { id: er.id },
      update: { amount: er.amount, payee: er.payee },
      create: {
        id: er.id,
        tenantId: tenant.id,
        categoryId: er.categoryId,
        amount: er.amount,
        payee: er.payee,
        description: er.description,
        paymentMethod: er.paymentMethod,
        expenseDate: todayDate,
        approvedById: defaultUsers[1].id
      }
    });
  }

  // 10. Today's Daily Kitchen Register & Production Loop
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const kitchenRegister = await prisma.kitchenRegister.upsert({
    where: { id: 'reg-today-001' },
    update: {
      businessDate: todayMidnight,
      status: 'OPEN'
    },
    create: {
      id: 'reg-today-001',
      tenantId: tenant.id,
      branchId: branch.id,
      businessDate: todayMidnight,
      status: 'OPEN'
    }
  });

  const sampleKitchenItems = [
    {
      id: 'kitem-001',
      menuItemId: 'menu-001', // Nshima with Chicken
      openingPortions: 0,
      preparedPortions: 35,
      soldPortions: 28,
      wastePortions: 1,
      staffMealPortions: 1,
      complimentaryPortions: 0,
      remainingPortions: 5
    },
    {
      id: 'kitem-002',
      menuItemId: 'menu-002', // Nshima with Beef Stew
      openingPortions: 0,
      preparedPortions: 25,
      soldPortions: 21,
      wastePortions: 1,
      staffMealPortions: 0,
      complimentaryPortions: 0,
      remainingPortions: 3
    },
    {
      id: 'kitem-003',
      menuItemId: 'menu-003', // Nshima with Bream Fish
      openingPortions: 0,
      preparedPortions: 18,
      soldPortions: 15,
      wastePortions: 0,
      staffMealPortions: 0,
      complimentaryPortions: 1,
      remainingPortions: 2
    },
    {
      id: 'kitem-004',
      menuItemId: 'menu-004', // Nshima with Beans & Veg
      openingPortions: 0,
      preparedPortions: 15,
      soldPortions: 12,
      wastePortions: 0,
      staffMealPortions: 1,
      complimentaryPortions: 0,
      remainingPortions: 2
    },
    {
      id: 'kitem-005',
      menuItemId: 'menu-005', // Rice with Chicken
      openingPortions: 0,
      preparedPortions: 15,
      soldPortions: 10,
      wastePortions: 0,
      staffMealPortions: 0,
      complimentaryPortions: 0,
      remainingPortions: 5
    }
  ];

  for (const ki of sampleKitchenItems) {
    await prisma.kitchenRegisterItem.upsert({
      where: { id: ki.id },
      update: {
        preparedPortions: ki.preparedPortions,
        soldPortions: ki.soldPortions,
        remainingPortions: ki.remainingPortions
      },
      create: {
        id: ki.id,
        registerId: kitchenRegister.id,
        menuItemId: ki.menuItemId,
        openingPortions: ki.openingPortions,
        preparedPortions: ki.preparedPortions,
        soldPortions: ki.soldPortions,
        wastePortions: ki.wastePortions,
        staffMealPortions: ki.staffMealPortions,
        complimentaryPortions: ki.complimentaryPortions,
        remainingPortions: ki.remainingPortions
      }
    });
  }

  // 11. Today's Realistic Live Sales & Receipts
  const sampleSales = [
    {
      id: 'sale-001',
      saleNumber: 'SALE-20261029-001',
      orderType: 'DINE_IN',
      tableNumber: 'Table 3',
      subtotal: 195.0,
      totalAmount: 195.0,
      cashierId: defaultUsers[3].id,
      items: [
        { menuItemId: 'menu-001', quantity: 2, unitPrice: 65.0, subtotal: 130.0 },
        { menuItemId: 'menu-003', quantity: 1, unitPrice: 65.0, subtotal: 65.0 }
      ],
      payment: { method: 'CASH', amount: 195.0 }
    },
    {
      id: 'sale-002',
      saleNumber: 'SALE-20261029-002',
      orderType: 'TAKEAWAY',
      subtotal: 150.0,
      totalAmount: 150.0,
      cashierId: defaultUsers[3].id,
      items: [
        { menuItemId: 'menu-002', quantity: 2, unitPrice: 60.0, subtotal: 120.0 },
        { menuItemId: 'menu-006', quantity: 2, unitPrice: 15.0, subtotal: 30.0 }
      ],
      payment: { method: 'AIRTEL_MONEY', amount: 150.0, reference: 'AM-TXN-984210' }
    },
    {
      id: 'sale-003',
      saleNumber: 'SALE-20261029-003',
      orderType: 'DINE_IN',
      tableNumber: 'Table 7',
      customerId: 'cust-001', // Kalumbila Mining Services Ltd
      subtotal: 580.0,
      totalAmount: 580.0,
      cashierId: defaultUsers[3].id,
      items: [
        { menuItemId: 'menu-001', quantity: 4, unitPrice: 65.0, subtotal: 260.0 },
        { menuItemId: 'menu-002', quantity: 4, unitPrice: 60.0, subtotal: 240.0 },
        { menuItemId: 'menu-007', quantity: 8, unitPrice: 10.0, subtotal: 80.0 }
      ],
      payment: { method: 'CUSTOMER_CREDIT', amount: 580.0, reference: 'PO-KMS-2026-99' }
    },
    {
      id: 'sale-004',
      saleNumber: 'SALE-20261029-004',
      orderType: 'DINE_IN',
      tableNumber: 'Table 1',
      subtotal: 145.0,
      totalAmount: 145.0,
      cashierId: defaultUsers[3].id,
      items: [
        { menuItemId: 'menu-005', quantity: 2, unitPrice: 65.0, subtotal: 130.0 },
        { menuItemId: 'menu-006', quantity: 1, unitPrice: 15.0, subtotal: 15.0 }
      ],
      payment: { method: 'MTN_MOMO', amount: 145.0, reference: 'MM-TXN-441299' }
    },
    {
      id: 'sale-005',
      saleNumber: 'SALE-20261029-005',
      orderType: 'DINE_IN',
      tableNumber: 'VIP Lounge',
      customerId: 'cust-002', // Manyama Transport
      subtotal: 420.0,
      totalAmount: 420.0,
      cashierId: defaultUsers[3].id,
      items: [
        { menuItemId: 'menu-003', quantity: 4, unitPrice: 65.0, subtotal: 260.0 },
        { menuItemId: 'menu-001', quantity: 2, unitPrice: 65.0, subtotal: 130.0 },
        { menuItemId: 'menu-006', quantity: 2, unitPrice: 15.0, subtotal: 30.0 }
      ],
      payment: { method: 'CUSTOMER_CREDIT', amount: 420.0, reference: 'VOUCHER-MTL-04' }
    }
  ];

  for (const s of sampleSales) {
    const createdSale = await prisma.sale.upsert({
      where: { id: s.id },
      update: { totalAmount: s.totalAmount, subtotal: s.subtotal },
      create: {
        id: s.id,
        tenantId: tenant.id,
        branchId: branch.id,
        cashierId: s.cashierId,
        customerId: s.customerId,
        saleNumber: s.saleNumber,
        orderType: s.orderType,
        tableNumber: s.tableNumber,
        subtotal: s.subtotal,
        totalAmount: s.totalAmount,
        paymentStatus: s.payment.method === 'CUSTOMER_CREDIT' ? 'CREDIT' : 'PAID'
      }
    });

    for (let i = 0; i < s.items.length; i++) {
      const it = s.items[i];
      await prisma.saleItem.upsert({
        where: { id: `${s.id}-item-${i + 1}` },
        update: { quantity: it.quantity, subtotal: it.subtotal },
        create: {
          id: `${s.id}-item-${i + 1}`,
          saleId: createdSale.id,
          menuItemId: it.menuItemId,
          unitPrice: it.unitPrice,
          unitCost: it.unitPrice * 0.45, // 45% estimated food cost
          quantity: it.quantity,
          subtotal: it.subtotal
        }
      });
    }

    await prisma.payment.upsert({
      where: { id: `${s.id}-pay` },
      update: { amount: s.payment.amount, paymentMethod: s.payment.method },
      create: {
        id: `${s.id}-pay`,
        saleId: createdSale.id,
        paymentMethod: s.payment.method,
        amount: s.payment.amount,
        reference: s.payment.reference
      }
    });
  }
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
