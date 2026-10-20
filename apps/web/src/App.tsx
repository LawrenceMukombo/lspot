import React, { useState } from 'react';
import { Navbar } from './components/Navbar.js';
import { Sidebar, NavTab } from './components/Sidebar.js';
import { DashboardView } from './pages/DashboardView.js';
import { PosView } from './pages/PosView.js';
import { KitchenView } from './pages/KitchenView.js';
import { InventoryView } from './pages/InventoryView.js';
import { MenuView } from './pages/MenuView.js';
import { CreditView } from './pages/CreditView.js';
import { InvoicesView } from './pages/InvoicesView.js';
import { ShiftsView } from './pages/ShiftsView.js';
import { FinanceView } from './pages/FinanceView.js';
import { ZraView } from './pages/ZraView.js';

export function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar currentTab={currentTab} onSelectTab={setCurrentTab} />

        <main className="flex-1 p-6 overflow-y-auto bg-slate-950">
          <div className="max-w-7xl mx-auto">
            {currentTab === 'dashboard' && <DashboardView />}
            {currentTab === 'pos' && <PosView />}
            {currentTab === 'kitchen' && <KitchenView />}
            {currentTab === 'inventory' && <InventoryView />}
            {currentTab === 'menu' && <MenuView />}
            {currentTab === 'credit' && <CreditView />}
            {currentTab === 'invoices' && <InvoicesView />}
            {currentTab === 'shifts' && <ShiftsView />}
            {currentTab === 'finance' && <FinanceView />}
            {currentTab === 'zra' && <ZraView />}
          </div>
        </main>
      </div>
    </div>
  );
}
export default App;
