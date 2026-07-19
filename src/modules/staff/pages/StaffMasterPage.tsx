// src/modules/staff/pages/StaffMasterPage.tsx

import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Clock,
  DollarSign,
  CreditCard,
  Truck,
  Users,
  FileText,
} from 'lucide-react';

// Import all Staff page components
import StaffDashboardPage from './StaffDashboardPage';
import DutyPlannerPage from './DutyPlannerPage';
import AttendanceRegisterPage from './AttendanceRegisterPage';
import LeaveManagementPage from './LeaveManagementPage';
import SalarySheetPage from './SalarySheetPage';
import SalaryRegisterPage from './SalaryRegisterPage';
import DriverPerformancePage from './DriverPerformancePage';
import SupervisorPerformancePage from './SupervisorPerformancePage';
import StaffReportsPage from './StaffReportsPage';

// ⏸️ ON HOLD – Not yet coded
// import EmployeeHistoryPage from './EmployeeHistoryPage';
// import AdvanceLoanRegisterPage from './AdvanceLoanRegisterPage';

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, component: StaffDashboardPage },
  { id: 'duty-planner', label: 'Duty Planner', icon: Calendar, component: DutyPlannerPage },
  { id: 'attendance', label: 'Attendance', icon: ClipboardList, component: AttendanceRegisterPage },
  { id: 'leave', label: 'Leave', icon: Clock, component: LeaveManagementPage },
  { id: 'salary-sheet', label: 'Salary Sheet', icon: DollarSign, component: SalarySheetPage },
  { id: 'salary-register', label: 'Salary Register', icon: CreditCard, component: SalaryRegisterPage },
  { id: 'driver-performance', label: 'Driver Perf.', icon: Truck, component: DriverPerformancePage },
  { id: 'supervisor-performance', label: 'Supervisor Perf.', icon: Users, component: SupervisorPerformancePage },
  { id: 'reports', label: 'Reports', icon: FileText, component: StaffReportsPage },
];

function StaffMasterPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Redirect /staff → /staff/dashboard
  useEffect(() => {
    if (location.pathname === '/staff' || location.pathname === '/staff/') {
      navigate('/staff/dashboard', { replace: true });
    }
  }, [location.pathname, navigate]);

  const pathSegments = location.pathname.split('/');
  const currentTab = pathSegments[pathSegments.length - 1] || 'dashboard';
  const activeTab = tabs.find((t) => t.id === currentTab) || tabs[0];
  const ActiveComponent = activeTab.component;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Tab Navigation */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="px-6">
          <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = location.pathname.includes(tab.id);
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(`/staff/${tab.id}`)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200
                    ${isActive
                      ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }
                  `}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-blue-700' : 'text-slate-400'}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <ActiveComponent embedded={true} />
      </div>
    </div>
  );
}

export default StaffMasterPage;