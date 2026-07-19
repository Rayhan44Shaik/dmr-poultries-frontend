import  { memo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface WeeklyAttendanceChartProps {
  data: {
    day: string;
    present: number;
    absent: number;
    leave: number;
  }[];
}

function WeeklyAttendanceChart({ data }: WeeklyAttendanceChartProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm h-full">
      <h3 className="text-sm font-semibold text-slate-700 mb-2 text-center">
        Weekly Attendance Overview
      </h3>
      <div className="h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
              }}
              // ✅ FIXED: Use (value: any, name: any) => [number, string]
              formatter={(value: any, name: any) => {
                const num = typeof value === 'number' ? value : parseFloat(value) || 0;
                const labels: Record<string, string> = {
                  present: 'Present',
                  absent: 'Absent',
                  leave: 'Leave',
                };
                return [num, labels[name] || name || ''];
              }}
            />
            <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
            <Bar dataKey="present" fill="#22C55E" name="Present" radius={[4, 4, 0, 0]} />
            <Bar dataKey="absent" fill="#EF4444" name="Absent" radius={[4, 4, 0, 0]} />
            <Bar dataKey="leave" fill="#3B82F6" name="Leave" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(WeeklyAttendanceChart);