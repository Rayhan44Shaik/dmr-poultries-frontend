import { Link } from 'react-router-dom';
import { addDays } from 'date-fns';
import { getFarmerPurchases, getEMIPayments } from '../services/storage';
import { formatCurrency } from '../utils/formatters';

// Helpers
const getFarms = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem('dmr-farms') || '[]');
  } catch {
    return [];
  }
};

const getShops = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem('dmr-shops') || '[]');
  } catch {
    return [];
  }
};

const getCollections = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem('dmr-collections') || '[]');
  } catch {
    return [];
  }
};

const OutstandingSummaryPage = () => {
  const farms = getFarms();
  const shops = getShops();
  const purchases = getFarmerPurchases();
  const collections = getCollections();
  const emis = getEMIPayments();

  // Pending farmer payments
  const pendingPurchases = purchases.filter(p => p.status !== 'Paid');
  const farmerPendingTotal = pendingPurchases.reduce((sum, p) => sum + (p.amount - p.paidAmount), 0);
  const top5Farms = pendingPurchases
    .map(p => {
      const farm = farms.find((f: any) => f.id === p.farmId);
      return { name: farm?.farmName || 'Unknown', amount: p.amount - p.paidAmount };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Pending shop collections
  const pendingCollections = collections.filter((c: any) => c.status !== 'Paid' && c.status !== 'Approved');
  const shopPendingTotal = pendingCollections.reduce((sum: number, c: any) => sum + (c.amount || 0), 0);
  const top5Shops = pendingCollections
    .map((c: any) => {
      const shop = shops.find((s: any) => s.id === c.shopId || s.shopName === c.shopName);
      return { name: shop?.shopName || c.shopName || 'Unknown', amount: c.amount || 0 };
    })
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);

  // Upcoming EMI (next 15 days)
  const today = new Date();
  const next15Days = addDays(today, 15);
  const upcomingEMIs = emis.filter(e => {
    const due = new Date(e.dueDate);
    return due >= today && due <= next15Days && e.status !== 'Paid';
  });
  const upcomingTotal = upcomingEMIs.reduce((sum, e) => sum + e.amount, 0);

  // Salary pending (dummy - can be extended)
  const salaryPending = 0;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Outstanding Summary</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pending Shop Collections */}
        <div className="bg-white rounded shadow border p-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Pending Shop Collections</h2>
            <span className="text-xl font-bold text-red-600">{formatCurrency(shopPendingTotal)}</span>
          </div>
          <div className="mt-3">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Top 5 Shops</h3>
            <ul className="space-y-1">
              {top5Shops.map((item, idx) => (
                <li key={idx} className="flex justify-between text-sm">
                  <span>{item.name}</span>
                  <span className="font-medium">{formatCurrency(item.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3 text-right">
            <Link to="/operations/collections/pending" className="text-blue-600 text-sm hover:underline">View All →</Link>
          </div>
        </div>

        {/* Pending Farmer Payments */}
        <div className="bg-white rounded shadow border p-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Pending Farmer Payments</h2>
            <span className="text-xl font-bold text-red-600">{formatCurrency(farmerPendingTotal)}</span>
          </div>
          <div className="mt-3">
            <h3 className="text-sm font-medium text-gray-500 mb-2">Top 5 Farms</h3>
            <ul className="space-y-1">
              {top5Farms.map((item, idx) => (
                <li key={idx} className="flex justify-between text-sm">
                  <span>{item.name}</span>
                  <span className="font-medium">{formatCurrency(item.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-3 text-right">
            <Link to="/accounts/farmer-payments" className="text-blue-600 text-sm hover:underline">View All →</Link>
          </div>
        </div>

        {/* Upcoming EMI */}
        <div className="bg-white rounded shadow border p-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Upcoming EMI (Next 15 Days)</h2>
            <span className="text-xl font-bold text-orange-600">{formatCurrency(upcomingTotal)}</span>
          </div>
          <div className="mt-2 text-sm">
            {upcomingEMIs.length > 0 ? (
              <ul>
                {upcomingEMIs.slice(0, 5).map((e, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>Due {e.dueDate}</span>
                    <span>{formatCurrency(e.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-400">No upcoming EMIs</p>
            )}
          </div>
          <div className="mt-3 text-right">
            <Link to="/accounts/vehicle-emi" className="text-blue-600 text-sm hover:underline">View All →</Link>
          </div>
        </div>

        {/* Salary Pending (placeholder) */}
        <div className="bg-white rounded shadow border p-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Salary Pending</h2>
            <span className="text-xl font-bold text-red-600">{formatCurrency(salaryPending)}</span>
          </div>
          <div className="mt-3 text-sm text-gray-500">
            (No salary data available)
          </div>
        </div>
      </div>
    </div>
  );
};

export default OutstandingSummaryPage;