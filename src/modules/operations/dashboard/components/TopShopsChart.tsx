import { useMemo } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TopShopsChartProps {
  data: any;
}

const COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#94a3b8"];

const formatIndianNumber = (num: number): string => {
  return num.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 1 });
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg p-3">
      <p className="font-medium text-sm text-slate-700">{data.name}</p>
      <p className="text-sm text-slate-600">₹{formatIndianNumber(data.amount)}</p>
      <p className="text-xs text-slate-400">{((data.percent || 0) * 100).toFixed(1)}%</p>
    </div>
  );
};

const CustomLegend = ({ payload }: any) => {
  const filtered = payload.filter((entry: any) => (entry.payload?.amount ?? 0) > 0);

  if (filtered.length === 0) {
    return <div className="text-xs text-slate-400 text-center mt-2">No positive sales</div>;
  }

  return (
    <div className="flex flex-wrap gap-2 mt-2 justify-center">
      {filtered.map((entry: any) => (
        <div key={entry.value} className="flex items-center gap-1.5 text-xs">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color }} />
          <span className="font-medium text-slate-600">{entry.value}</span>
          <span className="text-slate-400">
            ({((entry.payload?.percent || 0) * 100).toFixed(1)}%)
          </span>
        </div>
      ))}
    </div>
  );
};

export default function TopShopsChart({ data }: TopShopsChartProps) {
  console.log("=== 🚀 TopShopsChart Debug ===");
  console.log("Raw data received:", JSON.stringify(data, null, 2));

  const chartData = useMemo(() => {
    if (!data) {
      console.log("❌ Data is null/undefined");
      return [];
    }

    let items: any[] = [];

    // --- CASE 1: Direct array ---
    if (Array.isArray(data)) {
      console.log("✅ Data is an array, length:", data.length);
      items = data;
    }
    // --- CASE 2: Object with nested array ---
    else if (typeof data === "object") {
      console.log("📦 Data is an object, keys:", Object.keys(data));
      
      // Try common nested array keys
      const nestedKeys = ["shops", "items", "data", "list", "topShops"];
      let found = false;
      for (const key of nestedKeys) {
        if (data[key] && Array.isArray(data[key])) {
          console.log(`✅ Found nested array under key: "${key}"`);
          items = data[key];
          found = true;
          break;
        }
      }
      
      // --- CASE 3: Key-value pairs (shop name → amount) ---
      if (!found) {
        const values = Object.values(data);
        const allNumbers = values.every(v => typeof v === "number" && !isNaN(v));
        if (allNumbers) {
          console.log("✅ Treating as key-value pairs (shop → amount)");
          items = Object.entries(data).map(([name, amount]) => ({
            shopName: name,
            amount: Number(amount)
          }));
        }
      }
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      console.log("❌ No items to process");
      return [];
    }

    console.log("📋 Items before mapping:", items);

    // Map to { name, amount }
    const mapped = items
      .map((item: any) => {
        let amount = 0;
        let name = "Unknown";

        if (typeof item === "number") {
          amount = item;
          name = `Shop ${items.indexOf(item) + 1}`;
        } else if (typeof item === "object") {
          // Try ALL possible field names
          const possibleAmountFields = ["amount", "sales", "total", "value", "salesAmount", "totalSales", "amountValue"];
          const possibleNameFields = ["shopName", "name", "label", "title", "shop", "store"];

          for (const field of possibleAmountFields) {
            if (item[field] !== undefined && !isNaN(Number(item[field]))) {
              amount = Number(item[field]);
              break;
            }
          }

          for (const field of possibleNameFields) {
            if (item[field]) {
              name = String(item[field]);
              break;
            }
          }

          // Debug each item
          console.log(`🔍 Item:`, item, `→ Name: "${name}", Amount: ${amount}`);
        }

        return { name, amount };
      })
      .filter((item) => item.amount > 0);

    console.log("✅ Final filtered data (positive only):", mapped);
    console.log(`📊 Total shops with positive sales: ${mapped.length}`);
    console.log("💰 Total amount:", mapped.reduce((sum, d) => sum + d.amount, 0));

    return mapped;
  }, [data]);

  const totalAmount = useMemo(() => chartData.reduce((sum, d) => sum + d.amount, 0), [chartData]);

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-400">
        <p className="text-sm">No sales data available</p>
        <p className="text-xs text-slate-300 mt-1">(all shops have zero or no positive sales)</p>
        {/* 🔍 Debug section – expand to see raw data */}
        <details className="mt-2 text-left">
          <summary className="text-xs cursor-pointer text-blue-500 hover:text-blue-700">
            🔍 Click to see raw data
          </summary>
          <pre className="text-xs bg-slate-100 p-2 rounded mt-1 overflow-auto max-h-40 whitespace-pre-wrap">
            {JSON.stringify(data, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-2">Sales Amount by Shop (Top 5)</h3>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chartData}
            dataKey="amount"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={80}
            paddingAngle={2}
          >
            {chartData.map((_entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
                stroke="#fff"
                strokeWidth={1}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            dominantBaseline="central"
            className="text-sm font-bold text-slate-700"
          >
            {`₹${formatIndianNumber(totalAmount)}`}
            <tspan x="50%" dy="1.2em" className="text-xs font-normal text-slate-400">
              Total
            </tspan>
          </text>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}