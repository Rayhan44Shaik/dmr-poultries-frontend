// src/modules/staff/pages/StaffMasterPage.tsx

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, Clock, CreditCard } from 'lucide-react';

import PageLayout from '../../../components/common/PageLayout';
import DutyPlannerPage from './DutyPlannerPage';
import LeaveManagementPage from './LeaveManagementPage';
import SalaryRegisterPage from './SalaryRegisterPage';

const tabs = [
  { id: 'duty-planner', label: 'Duty Planner', icon: Calendar, component: DutyPlannerPage },
  { id: 'leave', label: 'Leave', icon: Clock, component: LeaveManagementPage },
  { id: 'salary-sheet', label: 'Salary Sheet', icon: CreditCard, component: SalaryRegisterPage },
];

function StaffMasterPage() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === '/staff' || location.pathname === '/staff/') {
      navigate('/staff/duty-planner', { replace: true });
    }
  }, [location.pathname, navigate]);

  const pathSegments = location.pathname.split('/');
  const currentTab = pathSegments[pathSegments.length - 1] || 'duty-planner';
  const activeTab = tabs.find((t) => t.id === currentTab) || tabs[0];
  const ActiveComponent = activeTab.component;

  return (
    <div className="min-h-screen bg-slate-50/70 pb-12">
      {/* Sticky Tab Navigation Bar matching the increased side padding */}
      <div className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-20 shadow-xs">
        <div className="w-full px-4 sm:px-6">
          <div className="flex items-center gap-2.5 overflow-x-auto py-3 scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = location.pathname.includes(tab.id);
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(`/staff/${tab.id}`)}
                  className={`
                    group flex items-center gap-2.5 px-4.5 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all duration-200 shadow-2xs cursor-pointer
                    ${isActive
                      ? 'bg-blue-600 text-white shadow-blue-500/25 shadow-md scale-[1.02]'
                      : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 border border-slate-200/70'
                    }
                  `}
                >
                  <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Tab Content wrapped in PageLayout */}
      <PageLayout>
        <ActiveComponent />
      </PageLayout>
    </div>
  );
}

export default StaffMasterPage;