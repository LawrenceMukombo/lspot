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
  AlertCircle
} from 'lucide-react';
import { apiRequest } from '../api.js';
import { formatZMW, PaymentMethod } from '@lspot/shared';

interface MenuItem {
  id: string;
  name: string;
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

  // Checkout modal
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [paymentReference, setPaymentReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<any>(null);

  useEffect(() => {
    loadCatalog();
    loadCustomers();
  }, []);

  const loadCatalog = async () => {
    try {
      const data = await apiRequest('/pos/catalog');
      if (data) {
        setCategories(data.categories || []);
        setItems(data.items || []);
      }
    } catch (e) {
      // Fallback Zambian sample data
      setItems([
        { id: 'm1', name: 'Nshima with Chicken', categoryId: 'c1', categoryName: 'Traditional Zambian Meals', sellingPrice: 65, portionSize: 'Standard Portion', remainingPortions: 18, isAvailable: true },
        { id: 'm2', name: 'Nshima with Beef Stew', categoryId: 'c1', categoryName: 'Traditional Zambian Meals', sellingPrice: 70, portionSize: 'Standard Portion', remainingPortions: 14, isAvailable: true },
        { id: 'm3', name: 'Nshima with Bream Fish', categoryId: 'c1', categoryName: 'Traditional Zambian Meals', sellingPrice: 75, portionSize: 'Whole Fish', remainingPortions: 8, isAvailable: true },
        { id: 'm4', name: 'Rice with Chicken', categoryId: 'c1', categoryName: 'Traditional Zambian Meals', sellingPrice: 65, portionSize: 'Standard Portion', remainingPortions: 12, isAvailable: true },
        { id: 'm5', name: 'Beans with Nshima & Veg', categoryId: 'c1', categoryName: 'Traditional Zambian Meals', sellingPrice: 40, portionSize: 'Standard Portion', remainingPortions: 20, isAvailable: true },
        { id: 'm6', name: 'Coca Cola 350ml Glass', categoryId: 'c2', categoryName: 'Cold Beverages', sellingPrice: 15, portionSize: 'Bottle', remainingPortions: 120, isAvailable: true },
        { id: 'm7', name: 'Bottled Mineral Water 500ml', categoryId: 'c2', categoryName: 'Cold Beverages', sellingPrice: 10, portionSize: 'Bottle', remainingPortions: 150, isAvailable: true }
      ]);
      setCategories([
        { id: 'c1', name: 'Traditional Zambian Meals' },
        { id: 'c2', name: 'Cold Beverages' }
      ]);
    }
  };

  const loadCustomers = async () => {
    try {
      const cust = await apiRequest('/credit/customers');
      if (cust) setCustomers(cust);
    } catch (e) {
      setCustomers([
        { id: 'cust-1', name: 'Kalumbila Mining Services Ltd', availableCredit: 11750, creditLimit: 15000 },
        { id: 'cust-2', name: 'Manyama Transport & Logistics', availableCredit: 6550, creditLimit: 8000 }
      ]);
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

  const filteredItems = items.filter((item) => {
    const matchesCat = activeCategory === 'ALL' || item.categoryId === activeCategory;
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  const handleCheckoutSubmit = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === PaymentMethod.CUSTOMER_CREDIT) {
      if (!selectedCustomerId) {
        alert('Please select a customer for Credit purchase');
        return;
      }
      if (selectedCustomer && cartSubtotal > selectedCustomer.availableCredit) {
        alert(`Credit limit exceeded! Customer available headroom: ${formatZMW(selectedCustomer.availableCredit)}`);
        return;
      }
    }

    setIsSubmitting(true);
    const payload = {
      idempotencyKey: crypto.randomUUID(),
      customerId: selectedCustomerId || undefined,
      orderType,
      tableNumber: tableNumber || undefined,
      items: cart.map((c) => ({
        menuItemId: c.id,
        portionSize: c.portionSize,
        unitPrice: c.sellingPrice,
        quantity: c.quantity,
        notes: c.notes
      })),
      subtotal: cartSubtotal,
      totalAmount: cartSubtotal,
      payments: [
        {
          method: paymentMethod,
          amount: cartSubtotal,
          reference: paymentReference || undefined
        }
      ]
    };

    try {
      const res = await apiRequest('/pos/checkout', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      setLastReceipt(res || { ...payload, saleNumber: `SALE-${Date.now().toString().slice(-6)}` });
      setCart([]);
      setShowCheckout(false);
      loadCatalog();
    } catch (err: any) {
      alert(`Checkout failed: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-6.5rem)]">
      {/* Left 2 Cols: Product Catalog & Touch Tiles */}
      <div className="lg:col-span-2 flex flex-col space-y-4 h-full overflow-hidden">
        {/* Search & Categories Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3.5 rounded-2xl shadow-lg">
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

        {/* Product Tiles Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3.5 pr-1">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => addToCart(item)}
              className="bg-slate-900 border border-slate-800 hover:border-amber-500/60 p-4 rounded-2xl flex flex-col justify-between shadow-md hover:shadow-xl transition-all cursor-pointer group active:scale-95 select-none"
            >
              <div>
                <div className="flex items-start justify-between gap-1 mb-1">
                  <h4 className="font-bold text-sm text-slate-100 group-hover:text-amber-400 transition leading-snug">
                    {item.name}
                  </h4>
                  <span
                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      item.remainingPortions > 5
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : item.remainingPortions > 0
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {item.remainingPortions} left
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">{item.portionSize}</p>
              </div>

              <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-800/80">
                <span className="font-mono font-bold text-amber-400 text-base">
                  {formatZMW(item.sellingPrice)}
                </span>
                <button className="w-7 h-7 rounded-lg bg-slate-800 group-hover:bg-amber-500 group-hover:text-slate-950 text-slate-300 flex items-center justify-center transition">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
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
        <div className="p-3 border-b border-slate-800 bg-slate-900/50 flex gap-2">
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
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
            className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
          />
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
                className="p-2.5 bg-slate-950/70 border border-slate-800/80 rounded-xl flex items-center justify-between text-sm"
              >
                <div className="flex-1 pr-2">
                  <p className="font-semibold text-slate-200 leading-tight">{item.name}</p>
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

          <button
            onClick={() => setShowCheckout(true)}
            disabled={cart.length === 0}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-extrabold text-base rounded-xl shadow-lg shadow-amber-500/20 transition active:scale-98 flex items-center justify-center gap-2"
          >
            <Banknote className="w-5 h-5" />
            Proceed to Payment ({formatZMW(cartSubtotal)})
          </button>
        </div>
      </div>

      {/* Checkout Modal */}
      {showCheckout && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">Complete Meal Checkout</h3>
                <p className="text-xs text-slate-400">The LSpot Restaurant POS Settlement</p>
              </div>
              <span className="text-xl font-mono font-extrabold text-amber-400">
                {formatZMW(cartSubtotal)}
              </span>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
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
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`p-3 rounded-xl border flex items-center gap-2.5 text-sm font-semibold transition ${
                        isSel
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-lg'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* MoMo Reference Input */}
            {(paymentMethod === PaymentMethod.AIRTEL_MONEY ||
              paymentMethod === PaymentMethod.MTN_MOMO) && (
              <div className="space-y-1">
                <label className="text-xs text-slate-400">Mobile Money Transaction Ref / ID</label>
                <input
                  type="text"
                  placeholder="e.g. TXN-98471203"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            )}

            {/* Credit Customer Details */}
            {paymentMethod === PaymentMethod.CUSTOMER_CREDIT && (
              <div className="p-3.5 bg-blue-950/40 border border-blue-900/60 rounded-xl space-y-1 text-xs">
                <div className="flex justify-between font-semibold text-blue-300">
                  <span>Customer:</span>
                  <span>{selectedCustomer?.name || 'No customer selected'}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Credit Limit:</span>
                  <span>{formatZMW(selectedCustomer?.creditLimit || 0)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Available Credit:</span>
                  <span className="font-bold text-emerald-400 font-mono">
                    {formatZMW(selectedCustomer?.availableCredit || 0)}
                  </span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-3">
              <button
                onClick={() => setShowCheckout(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm rounded-xl transition"
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

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-left space-y-1">
              <p className="text-center font-bold text-slate-200 border-b border-slate-800 pb-1 mb-2 font-sans">
                The LSpot Restaurant
              </p>
              <div className="flex justify-between">
                <span>Total Amount:</span>
                <span className="font-bold text-amber-400">{formatZMW(lastReceipt.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Payment:</span>
                <span>{lastReceipt.payments?.[0]?.paymentMethod || 'CASH'}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{new Date().toLocaleTimeString()}</span>
              </div>
            </div>

            <button
              onClick={() => setLastReceipt(null)}
              className="w-full py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition font-sans"
            >
              Start Next Order
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
