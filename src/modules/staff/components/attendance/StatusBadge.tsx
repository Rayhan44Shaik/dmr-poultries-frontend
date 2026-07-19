// src/modules/staff/components/attendance/StatusBadge.tsx

import { memo } from 'react';

interface StatusBadgeProps {
  status: string;
  onClick?: () => void;
  size?: 'sm' | 'md';
}

function StatusBadge({ status, onClick, size = 'md' }: StatusBadgeProps) {
  const getColor = (s: string) => {
    const colors: Record<string, string> = {
      P: 'bg-green-100 text-green-700 border-green-300',
      A: 'bg-red-100 text-red-700 border-red-300',
      H: 'bg-amber-100 text-amber-700 border-amber-300',
      L: 'bg-blue-100 text-blue-700 border-blue-300',
      WO: 'bg-slate-100 text-slate-600 border-slate-300',
    };
    return colors[s] || 'bg-slate-100 text-slate-500 border-slate-200';
  };

  const getLabel = (s: string) => {
    const labels: Record<string, string> = {
      P: 'P',
      A: 'A',
      H: 'H',
      L: 'L',
      WO: 'WO',
    };
    return labels[s] || s;
  };

  const sizeClasses = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-10 h-10 text-sm';

  return (
    <button
      onClick={onClick}
      className={`${sizeClasses} rounded-full border font-bold transition hover:shadow-md active:scale-95 ${getColor(status)}`}
      title={status}
    >
      {getLabel(status)}
    </button>
  );
}

export default memo(StatusBadge);