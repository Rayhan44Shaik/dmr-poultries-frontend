import { CheckCircle } from "lucide-react";

const activities = [
  "Vehicle AP39XX2345 departed",
  "Shop payment received",
  "New farmer added",
];

function RecentActivity() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-6">

      <h2 className="text-xl font-semibold mb-5">
        Recent Activity
      </h2>

      <div className="space-y-4">

        {activities.map((item, index) => (
          <div
            key={index}
            className="flex items-center gap-3"
          >
            <CheckCircle
              size={18}
              className="text-green-600"
            />

            <span className="text-gray-700">
              {item}
            </span>

          </div>
        ))}

      </div>

    </div>
  );
}

export default RecentActivity;