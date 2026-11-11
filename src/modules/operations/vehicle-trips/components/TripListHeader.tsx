import React from "react";
import { History } from "lucide-react";

interface TripListHeaderProps {
  title: string;
}

/** Trip List card heading; row identifiers own the view interaction. */
function TripListHeader({ title }: TripListHeaderProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-6 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 via-white to-blue-50/40">
      <div className="flex min-w-0 items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-blue-50/70 border border-blue-100 flex items-center justify-center text-blue-500 shadow-inner">
          <History className="w-5 h-5" />
        </div>
        <h3 className="text-base font-bold text-slate-800 tracking-tight">{title}</h3>
      </div>
    </div>
  );
}

export default React.memo(TripListHeader);
