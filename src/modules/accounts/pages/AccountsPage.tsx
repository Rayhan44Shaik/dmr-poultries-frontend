// src/modules/accounts/pages/AccountsPage.tsx

import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  PlusCircle,
  Sprout,
  Fuel,
  Truck,
  TrendingUp,
  BarChart3,
} from 'lucide-react';

import { PaymentBookPage } from './PaymentBookPage';
import { FarmerPaymentPage } from './FarmPaymentPage';
import { NewPaymentPage } from './NewPaymentPage';
import MarketRatePage from './MarketRatePage';
import SummaryPage from './SummaryPage';

const PlaceholderTab = ({ title }: { title: string }) => (
  <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-slate-200/80">
    <p className="text-slate-500 text-sm font-medium">{title} - Coming Soon</p>
  </div>
);
const FuelPaymentPage = () => <PlaceholderTab title="Fuel Payment" />;
const VehiclePaymentPage = () => <PlaceholderTab title="Vehicle Payment" />;

const tabs = [
  { key: 'paid-payments', label: 'Paid Payments', icon: CheckCircle, color: 'text-emerald-600', component: PaymentBookPage },
  { key: 'new-payments', label: 'New Payments', icon: PlusCircle, color: 'text-blue-600', component: NewPaymentPage },
  { key: 'farm-payment', label: 'Farm Payment', icon: Sprout, color: 'text-green-600', component: FarmerPaymentPage },
  { key: 'fuel-payment', label: 'Fuel Payment', icon: Fuel, color: 'text-amber-600', component: FuelPaymentPage },
  { key: 'vehicle-payment', label: 'Vehicle Payment', icon: Truck, color: 'text-purple-600', component: VehiclePaymentPage },
  { key: 'market-rate', label: 'Market Rate', icon: TrendingUp, color: 'text-indigo-600', component: MarketRatePage },
  { key: 'summary', label: 'Summary', icon: BarChart3, color: 'text-rose-600', component: SummaryPage },
];

function AccountsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const activeTab = searchParams.get('tab') || 'paid-payments';

  useEffect(() => {
    if (!searchParams.get('tab')) {
      navigate('/accounts?tab=paid-payments', { replace: true });
    }
  }, [location.search, navigate, searchParams]);

  const ActiveComponent = useMemo(() => {
    const found = tabs.find((tab) => tab.key === activeTab);
    return found ? found.component : PaymentBookPage;
  }, [activeTab]);

  const handleTabChange = (tabKey: string) => {
    navigate(`/accounts?tab=${tabKey}`);
  };

  return (
    <div className="w-full pt-4 pb-6 space-y-5">
      {/* Tab Bar */}
      <div className="bg-white border-y sm:border border-slate-200/90 sm:rounded-xl shadow-sm px-4 sm:px-6 py-1.5 w-full">
        <div
          className="flex items-center gap-1 overflow-x-auto hide-scrollbar"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`
                  flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0
                  ${isActive ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'}
                `}
              >
                <Icon size={18} className={isActive ? 'text-blue-700' : tab.color} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <ActiveComponent embedded={true} />
      </div>
    </div>
  );
}

export default React.memo(AccountsPage);