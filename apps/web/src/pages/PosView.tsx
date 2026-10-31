import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  Layers,
  CheckCircle,
  Receipt,
  User,
  AlertCircle,
  Info,
  X,
  Printer,
  QrCode,
  Sparkles,
  Award,
  Phone,
  WifiOff,
  Calculator,
  ShieldCheck
} from 'lucide-react';
import { apiRequest } from '../api.js';
import { formatZMW, PaymentMethod } from '@lspot/shared';
import { SmartCalculator } from '../components/SmartCalculator.js';
import { toast } from '../components/Toast.js';
import { offlineStorage } from '../utils/offlineStorage.js';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  categoryId: string;
  categoryName?: string;
  sellingPrice: number;
  portionSize: string;
  remainingPortions: number;
  isAvailable: boolean;
}

interface CartItem extends MenuItem {
  quantity: number;
  subtotal: number;
  notes?: string;
}

export function PosView() {
  const [categories, setCategories] = useState<any[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [orderType, setOrderType] = useState<'DINE_IN' | 'TAKEAWAY'>('DINE_IN');
  const [tableNumber, setTableNumber] = useState('');

  // Customer Loyalty & Stamp Card state
  const [loyaltyPhone, setLoyaltyPhone] = useState('');
  const [loyaltyProfile, setLoyaltyProfile] = useState<any | null>(null);
  const [redeemFreeSoftDrink, setRedeemFreeSoftDrink] = useState(false);

  // Item details modal
  const [detailItem, setDetailItem] = useState<MenuItem | null>(null);

  // Checkout modal
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [paymentReference, setPaymentReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<any>(null);
  const [activeShift, setActiveShift] = useState<any>(null);

  // DPO mobile-money collection state. PINs are entered only on the customer's wallet prompt.
  const [momoPhone, setMomoPhone] = useState('+260 97 ');
  const [momoPromptStage, setMomoPromptStage] = useState<'IDLE' | 'PUSHING' | 'WAITING' | 'APPROVED' | 'FAILED'>('IDLE');
  const [momoTransactionToken, setMomoTransactionToken] = useState('');
  const [momoInstructions, setMomoInstructions] = useState('');
  const [momoRedirectUrl, setMomoRedirectUrl] = useState('');

  // POS Embedded Smart Calculator
  const [showPosCalculator, setShowPosCalculator] = useState(false);

  const lookupLoyaltyPhone = async (phoneNum: string) => {
    setLoyaltyPhone(phoneNum);
    const cleaned = phoneNum.replace(/\s+/g, '');
    if (cleaned.length >= 9) {
      const storageKey = `lspot_loyalty_${cleaned}`;
      try {
        const remote = await apiRequest(`/pos/loyalty/${encodeURIComponent(cleaned)}`);
        if (remote) {
          localStorage.setItem(storageKey, JSON.stringify(remote));
          setLoyaltyProfile(remote);
          return;
        }
      } catch {
        // Offline fallback to localStorage
      }
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          setLoyaltyProfile(JSON.parse(saved));
        } catch {
          setLoyaltyProfile({ phone: cleaned, name: 'Valued Guest', stamps: 0, freeSoftDrinksEarned: 0 });
        }
      } else {
        const initial = {
          phone: cleaned,
          name: 'Valued Guest',
          stamps: 0,
          freeSoftDrinksEarned: 0
        };
        localStorage.setItem(storageKey, JSON.stringify(initial));
        setLoyaltyProfile(initial);
      }
    } else {
      setLoyaltyProfile(null);
      setRedeemFreeSoftDrink(false);
    }
  };

  useEffect(() => {
    loadCatalog();
    loadCustomers();
    checkShift();

    const handleRefreshCatalog = () => loadCatalog();
    window.addEventListener('kitchenRegisterUpdated', handleRefreshCatalog);
    window.addEventListener('focus', handleRefreshCatalog);
    const catalogPoll = setInterval(loadCatalog, 10000);

    return () => {
      window.removeEventListener('kitchenRegisterUpdated', handleRefreshCatalog);
      window.removeEventListener('focus', handleRefreshCatalog);
      clearInterval(catalogPoll);
    };
  }, []);

  const checkShift = async () => {
    try {
      const shift = await apiRequest('/shifts/current');
      setActiveShift(shift);
    } catch {
      setActiveShift(null);
    }
  };

  const loadCatalog = async () => {
    try {
      const data = await apiRequest('/pos/catalog');
      if (data) {
        const catList = data.categories || [];
        const itemList = data.items || [];
        setCategories(catList);
        setItems(itemList);
        offlineStorage.saveCatalog(catList, itemList);
      }
    } catch (e) {
      console.warn('Network error fetching catalog, loading from offline storage:', e);
      const cached = offlineStorage.getCachedCatalog();
      if (cached.items.length > 0) {
        setCategories(cached.categories);
        setItems(cached.items);
      }
    }
  };

  const loadCustomers = async () => {
    try {
      const cust = await apiRequest('/credit/customers');
      if (cust) {
        setCustomers(cust);
        offlineStorage.saveCustomers(cust);
      }
    } catch (e) {
      console.warn('Network error fetching customers, loading from offline storage:', e);
      const cached = offlineStorage.getCachedCustomers();
      if (cached.length > 0) {
        setCustomers(cached);
      }
    }
  };

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id
            ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.sellingPrice }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1, subtotal: item.sellingPrice }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.id === id) {
            const newQty = i.quantity + delta;
            return newQty > 0 ? { ...i, quantity: newQty, subtotal: newQty * i.sellingPrice } : null;
          }
          return i;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((i) => i.id !== id));
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const loyaltyDiscount =
    redeemFreeSoftDrink && (loyaltyProfile?.freeSoftDrinksEarned || 0) > 0
      ? Math.min(cartSubtotal, 15)
      : 0;
  const cartNetTotal = Math.max(0, cartSubtotal - loyaltyDiscount);

  // Reset DPO mobile-money state whenever the order total changes so a previous payment token cannot be reused for a modified cart
  useEffect(() => {
    if (momoPromptStage !== 'IDLE' || momoTransactionToken) {
      setMomoPromptStage('IDLE');
      setMomoTransactionToken('');
      setMomoInstructions('');
      setMomoRedirectUrl('');
      setPaymentReference('');
    }
  }, [cartNetTotal]);

  const filteredItems = items.filter((item) => {
    const matchesCat = activeCategory === 'ALL' || item.categoryId === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const handleInitiateMoMoPush = async () => {
    if (!momoPhone || momoPhone.replace(/\s+/g, '').length < 9) {
      toast.warning(
        'Please enter a valid Airtel or MTN mobile phone number (e.g. +260 97...).',
        'Mobile Number Required'
      );
      return;
    }
    setMomoPromptStage('PUSHING');
    try {
      const pushRes = await apiRequest('/pos/momo-initiate', {
        method: 'POST',
        body: JSON.stringify({
          provider: paymentMethod,
          phone: momoPhone,
          amount: cartNetTotal
        })
      });
      if (!pushRes?.transactionToken) throw new Error('DPO did not return a payment token.');
      setPaymentReference(pushRes.transactionRef || '');
      setMomoTransactionToken(pushRes.transactionToken);
      setMomoInstructions(pushRes.instructions || 'Approve the payment request on the customer’s phone.');
      setMomoRedirectUrl(pushRes.redirectUrl || '');
      setMomoPromptStage('WAITING');
      toast.info(
        pushRes.message || `Payment request dispatched to ${momoPhone}.`,
        'Mobile Money Push Sent'
      );
    } catch (err: any) {
      setMomoPromptStage('FAILED');
      toast.critical(err?.message || 'DPO could not start the mobile-money payment.', 'Mobile Money Request Failed');
    }
  };

  useEffect(() => {
    if (!momoTransactionToken || momoPromptStage !== 'WAITING') return;
    let active = true;
    const checkStatus = async () => {
      try {
        const payment = await apiRequest(`/pos/momo-status/${encodeURIComponent(momoTransactionToken)}`);
        if (!active) return;
        if (payment?.status === 'PAID' || payment?.status === 'AUTHORIZED') {
          setMomoPromptStage('APPROVED');
          toast.success('Payment confirmed by DPO. You can now complete the sale.', 'Mobile Money Approved');
        } else if (payment?.status === 'FAILED') {
          setMomoPromptStage('FAILED');
          toast.warning(payment?.explanation || 'The mobile-money payment was not completed.', 'Payment Not Completed');
        }
      } catch {
        // Keep waiting: temporary network failures must never turn into a paid sale.
      }
    };
    void checkStatus();
    const timer = window.setInterval(() => void checkStatus(), 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [momoTransactionToken, momoPromptStage]);

  const handleCheckoutSubmit = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === PaymentMethod.CUSTOMER_CREDIT) {
      if (!selectedCustomerId) {
        toast.warning('Please select a customer account for Credit purchase.', 'Customer Required');
        return;
      }
      if (selectedCustomer && cartNetTotal > selectedCustomer.availableCredit) {
        toast.critical(
          `Credit limit exceeded! Customer available headroom: ${formatZMW(selectedCustomer.availableCredit)}`,
          'Credit Limit Exceeded'
        );
        return;
      }
    }

    // Mobile Money Verification
    if (paymentMethod === PaymentMethod.AIRTEL_MONEY || paymentMethod === PaymentMethod.MTN_MOMO) {
      if (momoPromptStage !== 'APPROVED') {
        if (momoPromptStage === 'IDLE' || momoPromptStage === 'FAILED') void handleInitiateMoMoPush();
        else toast.info('Waiting for DPO to confirm the customer payment.', 'Payment Pending');
        return;
      }
    }

    setIsSubmitting(true);
    const generatedRef =
      paymentReference ||
      (paymentMethod === PaymentMethod.AIRTEL_MONEY || paymentMethod === PaymentMethod.MTN_MOMO
        ? `${paymentMethod === PaymentMethod.AIRTEL_MONEY ? 'AIRTEL' : 'MTN'}-${Date.now().toString().slice(-6)}`
        : undefined);

    const payload = {
      idempotencyKey: crypto.randomUUID(),
      dpoTransactionToken:
        paymentMethod === PaymentMethod.AIRTEL_MONEY || paymentMethod === PaymentMethod.MTN_MOMO
          ? momoTransactionToken
          : undefined,
      customerId: paymentMethod === PaymentMethod.CUSTOMER_CREDIT && selectedCustomerId ? selectedCustomerId : undefined,
      orderType,
      tableNumber: tableNumber || undefined,
      items: cart.map((c) => ({
        menuItemId: c.id,
        portionSize: c.portionSize || 'Standard Portion',
        unitPrice: c.sellingPrice,
        quantity: c.quantity,
        subtotal: c.subtotal || (c.sellingPrice * c.quantity),
        notes: c.notes || undefined
      })),
      subtotal: cartSubtotal,
      discountAmount: loyaltyDiscount,
      totalAmount: cartNetTotal,
      payments: [
        {
          method: paymentMethod,
          amount: cartNetTotal,
          reference: generatedRef
        }
      ]
    };

    try {
      let res: any = null;
      try {
        res = await apiRequest('/pos/checkout', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
      } catch (checkoutErr: any) {
        const errMsg = String(checkoutErr?.message || '');
        const isOfflineNetworkFailure =
          !navigator.onLine ||
          errMsg.includes('Offline Mode') ||
          errMsg.includes('Unable to reach server') ||
          errMsg.includes('Failed to fetch');

        // Never swallow server-side payment or stock rejections into the offline queue
        if (!isOfflineNetworkFailure) {
          throw checkoutErr;
        }
        // Mobile money requires live DPO confirmation before queueing
        if (
          (paymentMethod === PaymentMethod.AIRTEL_MONEY || paymentMethod === PaymentMethod.MTN_MOMO) &&
          !momoTransactionToken
        ) {
          throw new Error('Mobile money sales require live DPO payment confirmation.');
        }

        // Manyama offline local queue fallback
        const offlineQueueKey = 'lspot_offline_sales_queue';
        const existingQueue = JSON.parse(localStorage.getItem(offlineQueueKey) || '[]');
        const offlineSale = {
          ...payload,
          id: `offline-${Date.now()}`,
          saleNumber: `OFFLINE-${Date.now().toString().slice(-6)}`,
          offlineQueuedAt: new Date().toISOString()
        };
        existingQueue.push(offlineSale);
        localStorage.setItem(offlineQueueKey, JSON.stringify(existingQueue));
        window.dispatchEvent(new CustomEvent('offlineQueueUpdated'));
        res = offlineSale;
      }

      // Trigger Kitchen KDS new order chime event
      const kdsOrder = {
        id: res?.id || `kds-${Date.now()}`,
        saleNumber: res?.saleNumber || `ORD-${Date.now().toString().slice(-4)}`,
        orderType,
        tableNumber,
        items: cart.map((c) => ({ name: c.name, quantity: c.quantity, notes: c.notes })),
        createdAt: new Date().toISOString()
      };
      const existingKds = JSON.parse(localStorage.getItem('lspot_active_kds_orders') || '[]');
      existingKds.unshift(kdsOrder);
      localStorage.setItem('lspot_active_kds_orders', JSON.stringify(existingKds.slice(0, 20)));
      window.dispatchEvent(new CustomEvent('newKitchenTicketFired', { detail: kdsOrder }));

      // Update Customer Loyalty Stamp Card
      if (loyaltyProfile && loyaltyPhone) {
        const cleaned = loyaltyPhone.replace(/\s+/g, '');
        const nshimaMealsInOrder = cart.filter((c) => c.name.toLowerCase().includes('nshima')).reduce((s, c) => s + c.quantity, 0);
        const stampsEarned = nshimaMealsInOrder > 0 ? nshimaMealsInOrder : 1;
        let newStamps = (loyaltyProfile.stamps || 0) + stampsEarned;
        let earnedRewards = loyaltyProfile.freeSoftDrinksEarned || 0;
        if (redeemFreeSoftDrink && earnedRewards > 0) {
          earnedRewards -= 1;
        }
        if (newStamps >= 10) {
          earnedRewards += Math.floor(newStamps / 10);
          newStamps = newStamps % 10;
        }
        const updatedProfile = {
          ...loyaltyProfile,
          stamps: newStamps,
          freeSoftDrinksEarned: earnedRewards
        };
        localStorage.setItem(`lspot_loyalty_${cleaned}`, JSON.stringify(updatedProfile));
        setLoyaltyProfile(updatedProfile);
        apiRequest(`/pos/loyalty/${encodeURIComponent(cleaned)}`, {
          method: 'POST',
          body: JSON.stringify(updatedProfile)
        }).catch(() => {});
      }

      // Construct receipt representation ensuring numeric consistency
      const receiptTotal = Number(res?.totalAmount ?? payload.totalAmount ?? cartSubtotal);
      const receiptData = {
        ...(res || payload),
        saleNumber: res?.saleNumber || `SALE-${Date.now().toString().slice(-6)}`,
        totalAmount: receiptTotal,
        subtotal: Number(res?.subtotal ?? payload.subtotal ?? cartSubtotal),
        payments: res?.payments && res.payments.length > 0 ? res.payments : payload.payments,
        items: res?.items && res.items.length > 0 ? res.items : payload.items
      };

      setLastReceipt(receiptData);
      setCart([]);
      setShowCheckout(false);
      setRedeemFreeSoftDrink(false);
      setMomoPromptStage('IDLE');
      setMomoTransactionToken('');
      setMomoInstructions('');
      setMomoRedirectUrl('');
      setPaymentReference('');
      toast.success(
        `Sale ${receiptData.saleNumber} completed (${formatZMW(receiptTotal)}). Kitchen ticket dispatched.`,
        'Sale Completed'
      );
      loadCatalog();
      window.dispatchEvent(new CustomEvent('shiftUpdated'));
    } catch (err: any) {
      toast.critical(`Checkout failed: ${err.message}`, 'POS Checkout Failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[calc(100vh-6.5rem)] min-h-[calc(100vh-6.5rem)]">
      {/* Left 2 Cols: Product Catalog & Touch Tiles */}
      <div className="lg:col-span-2 flex flex-col space-y-4 h-full min-h-0 overflow-hidden">
        {/* Cashier Shift Status Banner if not open */}
        {!activeShift && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2 text-xs text-amber-300 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate">
                <strong>Notice:</strong> No cashier shift is currently open. Cash movements will record under General Till.
              </span>
            </div>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('navigateTab', { detail: 'shifts' }))}
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg transition shrink-0 whitespace-nowrap"
            >
              Open Shift
            </button>
          </div>
        )}

        {/* Search & Categories Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-lg shrink-0">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
            <button
              onClick={() => setActiveCategory('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                activeCategory === 'ALL'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              All Items
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                  activeCategory === cat.id
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search dishes or drinks..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Product Tiles Grid with High-Resolution Food Photography */}
        <div className="flex-1 min-h-0 overflow-y-auto pr-1.5 pb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5 auto-rows-max content-start">
          {filteredItems.map((item) => {
            const isOutOfStock = !item.remainingPortions || item.remainingPortions <= 0;
            const isBeverage = (item as any).isBeverage ||
              item.categoryName?.toLowerCase().includes('drink') ||
              item.categoryName?.toLowerCase().includes('beverage') ||
              item.categoryName?.toLowerCase().includes('water') ||
              item.name.toLowerCase().includes('water') ||
              item.name.toLowerCase().includes('coca') ||
              item.name.toLowerCase().includes('drink');

            return (
              <div
                key={item.id}
                onClick={() => {
                  if (isOutOfStock) {
                    toast.warning(
                      isBeverage
                        ? `Cannot add ${item.name}: Out of stock in Beverage Inventory.`
                        : `Cannot add ${item.name}: Requires an active Kitchen Cooking Batch with available portions.`,
                      isBeverage ? 'Beverage Out of Stock' : 'No Prepared Portions Available'
                    );
                    return;
                  }
                  addToCart(item);
                }}
                className={`bg-white dark:bg-slate-900 border rounded-2xl flex flex-col justify-between shadow-md transition-all duration-200 select-none overflow-hidden ${
                  isOutOfStock
                    ? 'border-rose-500/40 opacity-70 cursor-not-allowed'
                    : 'border-slate-200 dark:border-slate-800 hover:border-amber-500/80 hover:shadow-2xl cursor-pointer group active:scale-[0.98]'
                }`}
              >
                {/* Dish Photo Container - Prominent, Non-Shrinking Fixed Height */}
                <div className="relative w-full h-44 sm:h-48 shrink-0 bg-slate-950 overflow-hidden">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className={`w-full h-full object-cover transition-transform duration-500 ease-out ${
                        isOutOfStock ? 'grayscale' : 'group-hover:scale-105'
                      }`}
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-950 text-slate-400">
                      <Receipt className="w-10 h-10" />
                    </div>
                  )}
                  {/* Soft Gradient Overlay for Readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

                  {/* Stock / Batch Remaining Badge */}
                  <div className="absolute top-3 right-3 z-10">
                    <span
                      className={`text-xs font-mono font-bold px-3 py-1 rounded-full shadow-md backdrop-blur-md ${
                        item.remainingPortions > 5
                          ? 'bg-emerald-600/95 text-white dark:bg-emerald-950/90 dark:text-emerald-300 dark:border dark:border-emerald-500/40'
                          : item.remainingPortions > 0
                          ? 'bg-amber-500/95 text-slate-950 font-extrabold dark:bg-amber-950/90 dark:text-amber-300 dark:border dark:border-amber-500/40'
                          : 'bg-rose-600/95 text-white dark:bg-rose-950/90 dark:text-rose-300 dark:border dark:border-rose-500/40'
                      }`}
                    >
                      {item.remainingPortions > 0
                        ? `${item.remainingPortions} ${isBeverage ? 'units' : 'portions'}`
                        : isBeverage
                        ? 'Out of Stock'
                        : 'No Cooking Batch'}
                    </span>
                  </div>

                  {/* Info / Quick Dish Details Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDetailItem(item);
                    }}
                    title="View full culinary details"
                    className="absolute top-3 left-3 z-10 w-8 h-8 rounded-full bg-white/90 dark:bg-slate-950/80 hover:bg-amber-500 hover:text-white dark:hover:text-slate-950 text-slate-700 dark:text-slate-200 flex items-center justify-center backdrop-blur-md shadow-md border border-slate-200/80 dark:border-slate-700/80 transition"
                  >
                    <Info className="w-4 h-4" />
                  </button>

                  {/* Portion Size Badge on Image Bottom */}
                  <div className="absolute bottom-3 left-3 z-10">
                    <span className="text-xs font-bold tracking-wide bg-white/95 dark:bg-slate-900/90 backdrop-blur-md shadow-md border border-slate-200 dark:border-slate-700/60 text-slate-800 dark:text-slate-100 px-3 py-1 rounded-lg">
                      {isBeverage ? 'Beverage Inventory' : item.portionSize || 'Kitchen Recipe'}
                    </span>
                  </div>
                </div>

                {/* Dish Information Card Body */}
                <div className="p-4 flex flex-col justify-between flex-1 bg-white dark:bg-slate-900">
                  <div className="space-y-1.5">
                    <h4 className="font-extrabold text-base text-slate-900 dark:text-slate-100 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition leading-snug">
                      {item.name}
                    </h4>
                    {item.description ? (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 dark:text-slate-500">{item.categoryName || 'Kitchen Dish'}</p>
                    )}
                  </div>

                  {/* Price and Add Button Bar - High Visibility Selling Price */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="min-w-0">
                      <span className="text-[11px] uppercase font-extrabold tracking-wider text-slate-400 dark:text-slate-400 block">
                        PRICE
                      </span>
                      <span className="font-mono font-black text-amber-500 dark:text-amber-400 text-xl sm:text-2xl tracking-tight drop-shadow-sm whitespace-nowrap">
                        {formatZMW(item.sellingPrice)}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={isOutOfStock}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-black text-xs sm:text-sm shadow-lg shadow-amber-500/25 transition active:scale-95 shrink-0 whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>{isOutOfStock ? 'UNAVAILABLE' : 'ADD'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>

      {/* Right Col: Active Cart & Checkout Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-full shadow-2xl overflow-hidden">
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-100">Current Order</h3>
            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400 font-mono">
              {cart.reduce((s, i) => s + i.quantity, 0)} items
            </span>
          </div>

          <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setOrderType('DINE_IN')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                orderType === 'DINE_IN' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
              }`}
            >
              Dine-In
            </button>
            <button
              onClick={() => setOrderType('TAKEAWAY')}
              className={`px-2.5 py-1 rounded font-medium transition ${
                orderType === 'TAKEAWAY' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-slate-400'
              }`}
            >
              Takeaway
            </button>
          </div>
        </div>

        {/* Customer & Table Bar */}
        <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex gap-2 shrink-0">
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          >
            <option value="">Walk-in Cash Customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} (Credit: {formatZMW(c.availableCredit)})
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Table #"
            value={tableNumber}
            onChange={(e) => setTableNumber(e.target.value)}
            className="w-20 shrink-0 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Zambian Customer Loyalty & Meal Stamp Card Banner */}
        <div className="p-3 border-b border-slate-800 bg-amber-500/5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Zambian Diner Stamp Card</span>
            </span>
            <span className="text-[10px] text-slate-400">Buy 10 Nshima meals, get 1 free soft drink</span>
          </div>

          <div className="relative">
            <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Guest Phone (e.g. 0971234567)"
              value={loyaltyPhone}
              onChange={(e) => lookupLoyaltyPhone(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
            />
          </div>

          {loyaltyProfile && (
            <div className="p-2 bg-slate-950 border border-amber-500/20 rounded-lg space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">{loyaltyProfile.name}</span>
                <span className="font-mono text-[11px] text-amber-400 font-bold">
                  {loyaltyProfile.stamps}/10 Stamps
                </span>
              </div>

              {/* Visual 10-Stamp Punch Grid */}
              <div className="grid grid-cols-10 gap-1 pt-1">
                {Array.from({ length: 10 }).map((_, idx) => {
                  const hasStamp = idx < (loyaltyProfile.stamps || 0);
                  return (
                    <div
                      key={idx}
                      title={`Stamp #${idx + 1}`}
                      className={`h-4 rounded flex items-center justify-center text-[9px] font-bold transition ${
                        hasStamp
                          ? 'bg-amber-500 text-slate-950 shadow-sm shadow-amber-500/40'
                          : 'bg-slate-800 text-slate-600 border border-slate-700/50'
                      }`}
                    >
                      {hasStamp ? '✓' : idx + 1}
                    </div>
                  );
                })}
              </div>

              {loyaltyProfile.freeSoftDrinksEarned > 0 && (
                <div className="mt-1 flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 px-2 py-1 rounded text-[11px] text-emerald-400">
                  <span className="flex items-center gap-1">
                    <Award className="w-3.5 h-3.5" />
                    <strong>{loyaltyProfile.freeSoftDrinksEarned} Free Drink(s) Ready</strong>
                  </span>
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={redeemFreeSoftDrink}
                      onChange={(e) => setRedeemFreeSoftDrink(e.target.checked)}
                      className="rounded bg-slate-900 border-emerald-600 text-emerald-500 focus:ring-0"
                    />
                    <span className="font-bold">Redeem</span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cart Line Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-4">
              <Receipt className="w-10 h-10 text-slate-700 mb-2" />
              <p className="text-sm font-medium">Cart is empty</p>
              <p className="text-xs text-slate-600 mt-1">Tap dishes on the menu to add to this order</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-center justify-between text-sm gap-2"
              >
                {/* Food thumbnail */}
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="w-11 h-11 rounded-lg object-cover border border-slate-800 shrink-0"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 text-amber-500">
                    <Receipt className="w-5 h-5" />
                  </div>
                )}

                <div className="flex-1 min-w-0 pr-1">
                  <p className="font-semibold text-slate-200 leading-tight truncate">{item.name}</p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {formatZMW(item.sellingPrice)} × {item.quantity}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="p-1 hover:text-amber-400 text-slate-400"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-7 text-center font-mono font-bold text-xs text-slate-200">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="p-1 hover:text-amber-400 text-slate-400"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="w-20 text-right font-mono font-bold text-amber-400">
                    {formatZMW(item.subtotal)}
                  </span>

                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="p-1 text-slate-600 hover:text-rose-400 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Cart Total & Checkout Button */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 space-y-3">
          <div className="flex items-center justify-between text-base">
            <span className="font-bold text-slate-300">Total Payable:</span>
            <span className="font-mono font-extrabold text-2xl text-amber-400">
              {formatZMW(cartSubtotal)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPosCalculator(true)}
              title="Open Smart Zambian Restaurant Calculator (VAT 16%, Tips, Split Bill, Change return)"
              className="px-3.5 py-3 bg-slate-800 hover:bg-slate-700 text-amber-400 hover:text-amber-300 rounded-xl font-bold transition flex items-center justify-center gap-1.5 border border-slate-700/60 shadow-md shrink-0"
            >
              <Calculator className="w-5 h-5 text-amber-400" />
              <span className="text-xs">Calc</span>
            </button>

            <button
              onClick={() => setShowCheckout(true)}
              disabled={cart.length === 0}
              className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-extrabold text-base rounded-xl shadow-lg shadow-amber-500/20 transition active:scale-98 flex items-center justify-center gap-2"
            >
              <Banknote className="w-5 h-5" />
              Proceed to Payment ({formatZMW(cartSubtotal)})
            </button>
          </div>
        </div>
      </div>

      {/* POS Smart Calculator Modal */}
      <SmartCalculator
        isOpen={showPosCalculator}
        onClose={() => setShowPosCalculator(false)}
        defaultAmount={cartSubtotal}
      />

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-slate-950/75 dark:bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Complete Meal Checkout</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">The LSpot Restaurant POS Settlement</p>
              </div>
              <span className="text-xl font-mono font-extrabold text-amber-500 dark:text-amber-400">
                {formatZMW(cartSubtotal)}
              </span>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Select Settlement Method
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: PaymentMethod.CASH, label: 'Cash', icon: Banknote },
                  { id: PaymentMethod.AIRTEL_MONEY, label: 'Airtel Money', icon: Smartphone },
                  { id: PaymentMethod.MTN_MOMO, label: 'MTN MoMo', icon: Smartphone },
                  { id: PaymentMethod.CUSTOMER_CREDIT, label: 'Customer Credit', icon: CreditCard }
                ].map((m) => {
                  const Icon = m.icon;
                  const isSel = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => {
                        setPaymentMethod(m.id as any);
                        setMomoPromptStage('IDLE');
                        setMomoTransactionToken('');
                        setMomoInstructions('');
                        setMomoRedirectUrl('');
                        setPaymentReference('');
                      }}
                      className={`p-3 rounded-xl border flex items-center gap-2.5 text-sm font-semibold transition ${
                        isSel
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/20 font-bold'
                          : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-amber-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* DPO Mobile Money Push */}
            {(paymentMethod === PaymentMethod.AIRTEL_MONEY ||
              paymentMethod === PaymentMethod.MTN_MOMO) && (
              <div className="p-4 bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {paymentMethod === PaymentMethod.AIRTEL_MONEY ? 'Airtel Money (Zambia)' : 'MTN MoMo (Zambia)'}
                    </span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/20 font-bold uppercase font-mono">
                    DPO Pay
                  </span>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-600 dark:text-slate-400">Subscriber Phone Number</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="+260 97 1234567"
                      value={momoPhone}
                      onChange={(e) => setMomoPhone(e.target.value)}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                    />
                    {(momoPromptStage === 'IDLE' || momoPromptStage === 'FAILED') && (
                      <button
                        type="button"
                        onClick={handleInitiateMoMoPush}
                        className="px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition"
                      >
                        Push Prompt
                      </button>
                    )}
                  </div>
                </div>

                {/* DPO payment state — the wallet PIN must never be entered into this POS. */}
                {momoPromptStage === 'PUSHING' && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/30 rounded-xl flex items-center gap-3 text-xs text-amber-700 dark:text-amber-300 animate-pulse">
                    <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    <span>Sending instant USSD Push notification to subscriber phone...</span>
                  </div>
                )}

                {momoPromptStage === 'WAITING' && (
                  <div className="p-3.5 bg-white dark:bg-slate-900 border border-amber-500/40 rounded-xl space-y-3 animate-in fade-in shadow-sm">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                        <div className="w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        Awaiting customer approval
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">DPO verification active</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                      A payment request was sent to <strong className="text-slate-900 dark:text-white">{momoPhone}</strong>. The customer must enter their PIN on their own phone; the POS checks DPO for confirmation automatically.
                    </p>
                    {momoInstructions && <p className="text-[11px] text-slate-600 dark:text-slate-400 whitespace-pre-line">{momoInstructions}</p>}
                    {momoRedirectUrl && momoRedirectUrl.startsWith('https://') && (
                      <a href={momoRedirectUrl} target="_blank" rel="noopener noreferrer" className="inline-flex text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline">
                        Open required operator payment page
                      </a>
                    )}
                  </div>
                )}

                {momoPromptStage === 'APPROVED' && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                    DPO has confirmed this payment. Confirm the sale to print the receipt.
                  </div>
                )}

                <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-slate-900">
                  <label className="text-[11px] text-slate-500">Transaction Reference / Journal Note (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. TXN-98471203"
                    value={paymentReference}
                    onChange={(e) => setPaymentReference(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>
            )}

            {/* Credit Customer Details & In-Modal Account Selector */}
            {paymentMethod === PaymentMethod.CUSTOMER_CREDIT && (
              <div className="p-4 bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 rounded-xl space-y-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-300 uppercase mb-1">
                    Select Account Customer for Credit Sale
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full bg-white dark:bg-slate-950 border border-blue-300 dark:border-blue-800 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-900 dark:text-slate-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- Click to choose Corporate Account / Customer --</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — Headroom: {formatZMW(c.availableCredit)} (Limit: {formatZMW(c.creditLimit)})
                      </option>
                    ))}
                  </select>
                </div>

                {selectedCustomer ? (
                  <div className="pt-2 border-t border-blue-200 dark:border-blue-900/60 space-y-1">
                    <div className="flex justify-between font-bold text-blue-900 dark:text-blue-300">
                      <span>Selected Account:</span>
                      <span>{selectedCustomer.name}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Total Approved Credit Limit:</span>
                      <span className="font-mono">{formatZMW(selectedCustomer.creditLimit || 0)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 dark:text-slate-400">
                      <span>Available Credit Headroom:</span>
                      <span className={`font-bold font-mono ${selectedCustomer.availableCredit >= cartSubtotal ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {formatZMW(selectedCustomer.availableCredit || 0)}
                      </span>
                    </div>
                    {selectedCustomer.availableCredit < cartSubtotal && (
                      <p className="text-[11px] text-rose-600 dark:text-rose-400 font-semibold mt-1">
                        ⚠️ Order total ({formatZMW(cartSubtotal)}) exceeds remaining credit limit!
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 italic">
                    ⚠️ Please select a corporate customer account to charge this meal to credit.
                  </p>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-3">
              <button
                onClick={() => setShowCheckout(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-sm rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCheckoutSubmit}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-amber-500/20"
              >
                {isSubmitting ? 'Posting Sale...' : `Confirm & Print Receipt`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sale Receipt Confirmation Modal */}
      {lastReceipt && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl text-center space-y-4 font-mono">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white font-sans">Sale Completed!</h3>
              <p className="text-xs text-slate-400">{lastReceipt.saleNumber}</p>
            </div>

            <div className="p-4 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-left space-y-2 text-slate-800 dark:text-slate-200 shadow-sm">
              <div className="text-center border-b border-dashed border-slate-300 dark:border-slate-700 pb-2 mb-2 font-sans">
                <p className="font-extrabold text-sm text-slate-900 dark:text-white">THE LSPOT RESTAURANT</p>
                <p className="text-[10px] text-slate-500">Manyama, Kalumbila, Zambia</p>
                <p className="text-[10px] text-slate-500 font-mono">TPIN: 1004829104 • VAT Reg: 16%</p>
              </div>

              <div className="flex justify-between">
                <span className="text-slate-500">Receipt Ref:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{lastReceipt.saleNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Tendered:</span>
                <span className="font-bold">{lastReceipt.payments?.[0]?.paymentMethod || 'CASH'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Date & Time (CAT):</span>
                <span>
                  {new Date(lastReceipt.createdAt || Date.now()).toLocaleString('en-GB', {
                    timeZone: 'Africa/Lusaka',
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm font-bold border-t border-dashed border-slate-300 dark:border-slate-700 pt-2 text-slate-900 dark:text-white">
                <span>TOTAL PAID:</span>
                <span className="font-mono text-amber-600 dark:text-amber-400">
                  {formatZMW(
                    lastReceipt.totalAmount ||
                    lastReceipt.payments?.[0]?.amount ||
                    lastReceipt.subtotal ||
                    0
                  )}
                </span>
              </div>

              {/* Fiscal Smart Invoice Compliance Footer */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 text-center space-y-0.5">
                <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1">
                  <QrCode className="w-3 h-3" /> ZRA FISCALIZED CODE
                </p>
                <p className="font-mono">{lastReceipt.fiscalInvoiceNo || `ZRA-${lastReceipt.saleNumber?.slice(-6) || 'ZM92'}`}</p>
                <p className="italic">Thank you for dining with us!</p>
              </div>
            </div>

            <div className="flex items-center gap-2 font-sans">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl border border-slate-300 dark:border-slate-700 transition flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Receipt</span>
              </button>
              <button
                onClick={() => setLastReceipt(null)}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition shadow-md shadow-amber-500/20"
              >
                Next Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dish Details Modal with Large Photography */}
      {detailItem && (
        <div
          onClick={() => setDetailItem(null)}
          className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200"
          >
            {/* Hero Image Container */}
            <div className="relative w-full h-56 bg-slate-950">
              {detailItem.imageUrl ? (
                <img
                  src={detailItem.imageUrl}
                  alt={detailItem.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-700">
                  <Receipt className="w-16 h-16" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-black/40" />

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setDetailItem(null)}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-slate-950/80 hover:bg-slate-800 text-slate-200 flex items-center justify-center backdrop-blur-md border border-slate-700/60 transition"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Category & Remaining Portions */}
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-amber-500/90 text-slate-950 shadow-md">
                  {detailItem.categoryName || 'Kitchen Dish'}
                </span>
                <span
                  className={`text-xs font-mono font-bold px-2.5 py-1 rounded-lg backdrop-blur-md ${
                    detailItem.remainingPortions > 5
                      ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/30'
                      : detailItem.remainingPortions > 0
                      ? 'bg-amber-950/90 text-amber-300 border border-amber-500/30'
                      : 'bg-rose-950/90 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {detailItem.remainingPortions} Portions Left Today
                </span>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight leading-snug">
                    {detailItem.name}
                  </h3>
                  <p className="text-xs font-medium text-amber-400/90 mt-0.5">
                    Portion: {detailItem.portionSize}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] uppercase font-bold text-slate-400 block">SELLING PRICE</span>
                  <span className="text-3xl font-black font-mono text-amber-400 drop-shadow-sm">
                    {formatZMW(detailItem.sellingPrice)}
                  </span>
                </div>
              </div>

              {detailItem.description && (
                <div className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-2xl text-xs text-slate-300 leading-relaxed">
                  <span className="font-semibold text-slate-200 block mb-1">Culinary Description:</span>
                  {detailItem.description}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl">
                  <span className="text-slate-500 block text-[10px] uppercase">Service Type</span>
                  <span className="font-semibold text-slate-200 mt-0.5 block">Dine-in or Takeaway</span>
                </div>
                <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl">
                  <span className="text-slate-500 block text-[10px] uppercase">Preparation</span>
                  <span className="font-semibold text-slate-200 mt-0.5 block">Cooked Daily on Site</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDetailItem(null)}
                  className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm rounded-xl transition"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    addToCart(detailItem);
                    setDetailItem(null);
                  }}
                  className="flex-2 flex items-center justify-center gap-2 py-3 px-5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition shadow-lg shadow-amber-500/20 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Add to Current Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
