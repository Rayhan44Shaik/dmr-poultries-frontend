import { Navigate, useLocation } from "react-router-dom";
import ShopLedgerPage from "./ShopLedgerPage";

/**
 * Reports intentionally has one owned page: Shop Ledger.
 * Collection Report and Analysis remain their existing single implementations
 * in Operations and Accounts; the Reports menu links to those pages directly.
 * Old report bookmarks are redirected instead of leaving a broken screen.
 */
export default function ReportsDashboardPage() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const tab = params.get("tab");

  if (tab === "collection") {
    return <Navigate to="/operations?tab=collection-report" replace />;
  }
  if (tab === "analysis") {
    return <Navigate to="/accounts?tab=summary" replace />;
  }
  if (location.pathname !== "/reports" || (tab && tab !== "shopLedger")) {
    return <Navigate to="/reports?tab=shopLedger" replace />;
  }
  if (!tab) {
    return <Navigate to="/reports?tab=shopLedger" replace />;
  }

  return (
    <div className="w-full px-4 pb-8 pt-6 sm:px-5 lg:px-6">
      <div className="mx-auto w-full max-w-[1600px]">
        <ShopLedgerPage embedded />
      </div>
    </div>
  );
}
