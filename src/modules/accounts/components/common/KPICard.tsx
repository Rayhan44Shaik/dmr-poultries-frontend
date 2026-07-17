import { memo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string;
  trend?: number;
  subtitle?: string;
}

export const KPICard = memo(({ title, value, trend, subtitle }: KPICardProps) => {
  const trendColor = trend !== undefined 
    ? (trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : 'text-gray-400')
    : 'text-gray-400';
  const TrendIcon = trend !== undefined 
    ? (trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus)
    : Minus;

  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200 transition-all hover:shadow-md">
      <div className="text-sm text-gray-500 font-medium">{title}</div>
      <div className="flex items-end justify-between mt-1">
        <div className="text-2xl font-bold">{value}</div>
        {trend !== undefined && (
          <div className={`flex items-center text-sm ${trendColor}`}>
            <TrendIcon className="w-4 h-4 mr-1" />
            <span>{trend > 0 ? '+' : ''}{trend}%</span>
          </div>
        )}
      </div>
      {subtitle && <div className="text-xs text-gray-400 mt-1">{subtitle}</div>}
    </div>
  );
});
KPICard.displayName = 'KPICard';