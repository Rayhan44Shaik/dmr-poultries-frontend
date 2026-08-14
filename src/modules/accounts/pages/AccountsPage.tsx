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
import ModuleTabs, { type ModuleTab } from '../../../ui/ModuleTabs';

// ---- Reusable "Coming Soon" Component ----
const ComingSoonTab = ({ title }: { title: string }) => (
  <div className="w-full flex items-center justify-center animate-fade-in min-h-[50vh]">
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-card p-12 text-center max-w-md w-full mx-4">
      <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-xl flex items-center justify-center mx-auto mb-4">
        <BarChart3 size={24} />
      </div>
      <h2 className="text-lg font-bold text-slate-800 mb-2">{title}</h2>
      <p className="text-sm text-slate-500 leading-relaxed">
        This module is being finalised and will be available in an upcoming update.
      </p>
    </div>
  </div>
);

const FuelPaymentPage = () => <ComingSoonTab title="Fuel Payment" />;
const VehiclePaymentPage = () => <ComingSoonTab title="Vehicle Payment" />;

const tabs: ModuleTab[] = [
  { key: 'paid-payments', label: 'Collection Register', icon: CheckCircle, color: 'text-emerald-500' },
  { key: 'market-rate', label: 'Market Rate', icon: TrendingUp, color: 'text-indigo-500' },
  { key: 'summary', label: 'Accounts Summary', icon: BarChart3, color: 'text-rose-500' },
  { key: 'farm-payment', label: 'Farm Payment', icon: Sprout, color: 'text-green-500' },
  { key: 'new-payments', label: 'New Payments', icon: PlusCircle, color: 'text-sky-500' },
  { key: 'fuel-payment', label: 'Fuel Payment', icon: Fuel, color: 'text-amber-500' },
  { key: 'vehicle-payment', label: 'Vehicle Payment', icon: Truck, color: 'text-violet-500' },
];

const tabComponents: Record<string, React.ComponentType<{ embedded?: boolean }>> = {
  'paid-payments': PaymentBookPage,
  'market-rate': MarketRatePage,
  'summary': SummaryPage,
  'farm-payment': FarmerPaymentPage,
  'new-payments': NewPaymentPage,
  'fuel-payment': FuelPaymentPage,
  'vehicle-payment': VehiclePaymentPage,
};

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
    return tabComponents[activeTab] ?? PaymentBookPage;
  }, [activeTab]);

  const handleTabChange = (tabKey: string) => {
    navigate(`/accounts?tab=${tabKey}`);
  };

  return (
    <div className="mx-auto w-full max-w-[1480px] space-y-4 pb-6">
      <ModuleTabs tabs={tabs} activeKey={activeTab} onChange={handleTabChange} className="px-4 pt-3 sm:px-6 lg:px-8" />

      {/* Content */}
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <ActiveComponent embedded={true} />
      </div>
    </div>
  );
}

export default React.memo(AccountsPage);