// src/modules/order/pages/NewOrderPage.tsx
// New Order entry screen.

import { ArrowLeft, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import OrderForm from "../components/OrderForm";
import { useOrders } from "../store/orderContext";
import type { OrderDraft } from "../types/orderTypes";

export default function NewOrderPage() {
  const navigate = useNavigate();
  const { addOrder } = useOrders();

  const handleSubmit = (draft: OrderDraft) => {
    const order = addOrder(draft);
    navigate("/order", { state: { createdOrder: order.orderNumber } });
  };

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 md:px-6 md:py-6">
      <button
        type="button"
        onClick={() => navigate("/order")}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-800"
      >
        <ArrowLeft size={16} />
        Back to Orders
      </button>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <OrderForm onSubmit={handleSubmit} onCancel={() => navigate("/order")} />
        </div>

        {/* Context panel */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-slate-800">Pickup Source</h3>
            <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <p className="text-xs font-semibold text-slate-700">Farm: From Trip Entry Step 2</p>
              <p className="mt-1 text-[11px] text-slate-400">
                The pickup farm is inherited from the existing trip workflow — it is not created here.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg bg-white p-2">
                  <p className="font-semibold uppercase tracking-wider text-slate-400">Pickup GPS</p>
                  <p className="font-semibold text-slate-600">Available / Pending</p>
                </div>
                <div className="rounded-lg bg-white p-2">
                  <p className="font-semibold uppercase tracking-wider text-slate-400">Pickup Status</p>
                  <p className="font-semibold text-slate-600">Not Assigned / Assigned</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h3 className="mb-3 text-sm font-bold text-slate-800">Order Flow</h3>
            <ol className="space-y-2 text-xs text-slate-600">
              {["Order", "Trip", "Farm Pickup", "Vehicle", "Delivery Route"].map((step, i, arr) => (
                <li key={step} className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-700">
                    {i + 1}
                  </span>
                  {step}
                  {i < arr.length - 1 && <span className="text-slate-300">↓</span>}
                </li>
              ))}
            </ol>
          </div>

          <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200/70 bg-amber-50/60 p-4 text-xs text-amber-800">
            <Info size={15} className="mt-0.5 shrink-0" />
            <p>
              Route priority depends on distance, deadline and customer importance — not distance alone.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
