import type{ ReactNode } from "react";

type StatCardProps = {
  title: string;
  value: string;
  icon: ReactNode;
  color?: string;
};

function StatCard({
  title,
  value,
  icon,
  color = "bg-green-600",
}: StatCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 hover:shadow-lg transition duration-300">

      <div className="flex justify-between items-center">

        <div>

          <p className="text-gray-500 text-sm">
            {title}
          </p>

          <h2 className="text-3xl font-bold mt-2 text-slate-800">
            {value}
          </h2>

        </div>

        <div
          className={`${color} h-14 w-14 rounded-xl flex items-center justify-center text-white`}
        >
          {icon}
        </div>

      </div>

    </div>
  );
}

export default StatCard;