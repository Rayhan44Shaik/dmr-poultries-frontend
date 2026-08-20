// src/modules/order/components/CustomerTrackingLink.tsx
// Frontend UI for generating/displaying a customer tracking link. The real
// secure token is wired up by the backend later — never expose internal ids.

import { useMemo, useState } from "react";
import { Copy, ExternalLink, Link2 } from "lucide-react";

interface CustomerTrackingLinkProps {
  orderNumber: string;
  destinationShop: string;
}

export default function CustomerTrackingLink({ orderNumber, destinationShop }: CustomerTrackingLinkProps) {
  const [copied, setCopied] = useState(false);

  // Placeholder public token — replaced by a backend-issued secure token later.
  const trackingUrl = useMemo(() => {
    const token = btoa(`track-${orderNumber}`).replace(/=+$/, "");
    return `${window.location.origin}/track/${token}`;
  }, [orderNumber]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(trackingUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable — no-op */
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <Link2 size={16} />
        </span>
        <div>
          <p className="text-sm font-bold text-slate-800">Customer Tracking</p>
          <p className="text-[11px] text-slate-400">Status: Tracking Link Ready</p>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Destination</p>
        <p className="text-sm font-medium text-slate-700">{destinationShop}</p>
        <p className="mt-2 truncate font-mono text-[11px] text-slate-400">{trackingUrl}</p>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={copy}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50"
        >
          <Copy size={13} />
          {copied ? "Copied!" : "Copy Tracking Link"}
        </button>
        <button
          type="button"
          onClick={() => window.open(trackingUrl, "_blank", "noopener,noreferrer")}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-700"
        >
          <ExternalLink size={13} />
          Open Tracking
        </button>
      </div>
    </div>
  );
}
