// src/modules/dashboard/DashboardPage.tsx

import WelcomeCard from "../../shared/components/WelcomeCard/WelcomeCard";
import SectionTitle from "../../shared/components/SectionTitle/SectionTitle";
import StatCard from "../../shared/components/StatCard/StatCard";
import RecentActivity from "../../shared/components/RecentActivity/RecentActivity";
import BusinessChart from "../../shared/components/BusinessChart/BusinessChart";

import {
  Store,
  Warehouse,
  Truck,
  Users,
  IndianRupee,
  Egg,
  Package,
} from "lucide-react";

function DashboardPage() {
  return (
    <div className="space-y-6">
      <WelcomeCard />

      <SectionTitle title="Business Overview" />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Shops"
          value="24"
          icon={<Store size={28} />}
        />
        <StatCard
          title="Farms"
          value="8"
          icon={<Warehouse size={28} />}
        />
        <StatCard
          title="Vehicles"
          value="12"
          icon={<Truck size={28} />}
        />
        <StatCard
          title="Employees"
          value="61"
          icon={<Users size={28} />}
        />
      </div>

      <SectionTitle title="Today's Business" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Collections"
          value="₹2.35L"
          icon={<IndianRupee size={28} />}
          color="bg-blue-600"
        />
        <StatCard
          title="Deliveries"
          value="18"
          icon={<Package size={28} />}
          color="bg-orange-500"
        />
        <StatCard
          title="Bird Count"
          value="94,600"
          icon={<Egg size={28} />}
          color="bg-green-600"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <BusinessChart />
        </div>
        <RecentActivity />
      </div>
    </div>
  );
}

export default DashboardPage;