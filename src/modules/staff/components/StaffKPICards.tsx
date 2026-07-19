import React, { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  UserCheck,
  UserCog,
  UserX,
  AlertCircle,
} from 'lucide-react';

interface KPICardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  onClick?: () => void;
}

const KPICard = memo(function KPICard({
  label,
  value,
  icon,
  color,
  bgColor,
  onClick,
}: KPICardProps) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start p-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 w-full text-left ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className={`${bgColor} p-2 rounded-lg mb-2`}>
        <div className={color}>{icon}</div>
      </div>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
        {label}
      </p>
      <p className={`text-2xl font-bold ${color} mt-1`}>{value}</p>
    </button>
  );
});

interface StaffKPICardsProps {
  data: {
    totalEmployees: number;
    presentToday: number;
    onDutyToday: number;
    onLeave: number;
    salaryPending: number;
  };
}

function StaffKPICards({ data }: StaffKPICardsProps) {
  const navigate = useNavigate();

  const cards: KPICardProps[] = [
    {
      label: 'Total Employees',
      value: data.totalEmployees,
      icon: <Users size={20} />,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      onClick: () => navigate('/masters?tab=employees'),
    },
    {
      label: 'Present Today',
      value: data.presentToday,
      icon: <UserCheck size={20} />,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      onClick: () => navigate('/staff/attendance?status=present'),
    },
    {
      label: 'On Duty Today',
      value: data.onDutyToday,
      icon: <UserCog size={20} />,
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      onClick: () => navigate('/staff/duty-planner'),
    },
    {
      label: 'On Leave',
      value: data.onLeave,
      icon: <UserX size={20} />,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      onClick: () => navigate('/staff/leave-management'),
    },
    {
      label: 'Salary Pending',
      value: data.salaryPending,
      icon: <AlertCircle size={20} />,
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
      onClick: () => navigate('/staff/salary-register?status=pending'),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
      {cards.map((card) => (
        <KPICard key={card.label} {...card} />
      ))}
    </div>
  );
}

export default memo(StaffKPICards);