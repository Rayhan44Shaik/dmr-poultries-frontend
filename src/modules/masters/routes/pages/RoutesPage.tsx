import React, { useState, useMemo } from "react";
import DashboardLayout from "../../../../layouts/DashboardLayout/DashboardLayout";
import PageLayout from "../../../../components/common/PageLayout";
import RouteTable from "../components/RouteTable";
import RouteDialog from "../dialogs/RouteDialog";
import { useRoutes } from "../hooks/useRoutes";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import { exportToPDF, exportToExcel } from "../../../../utils/exportUtils";
import { logAuditEvent } from "../../../../utils/securityUtils";
import { handleApiError } from "../services/routeService";
import type { Route } from "../types/route";

type RoutesPageProps = { embedded?: boolean };

const ITEMS_PER_PAGE = 10;

function RoutesPage({ embedded = false }: RoutesPageProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingRoute, setEditingRoute] = useState<Route | null>(null);
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { showNotification } = useSafeNotification();
  const {
    routes,
    loading,
    saving,
    error,
    reload,
    addRoute,
    editRoute,
    removeRoute,
  } = useRoutes();

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setCurrentPage(1);
  };

  const filteredRoutes = useMemo(() => {
    const keyword = search.toLowerCase();
    return routes.filter(
      (route) =>
        route.routeName.toLowerCase().includes(keyword) ||
        route.routeCode.toLowerCase().includes(keyword) ||
        route.description.toLowerCase().includes(keyword)
    );
  }, [routes, search]);

  const totalPages = Math.ceil(filteredRoutes.length / ITEMS_PER_PAGE) || 1;
  const paginatedRoutes = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRoutes.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredRoutes, currentPage]);

  const handleExportPDF = () => {
    if (filteredRoutes.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = ["Route No", "Route Name", "Route Code", "Description", "Status"];
    const rows = filteredRoutes.map((route) => [
      route.routeNo.toString(),
      route.routeName,
      route.routeCode || "-",
      route.description || "-",
      route.status,
    ]);
    const filename = `Routes_${new Date().toISOString().split("T")[0]}`;
    exportToPDF("Routes - Master List", headers, rows, filename);
    logAuditEvent("EXPORT_PDF", "Routes", undefined, { count: filteredRoutes.length });
    showNotification("PDF exported successfully!", "success");
  };

  const handleExportExcel = () => {
    if (filteredRoutes.length === 0) {
      showNotification("No data to export.", "error");
      return;
    }
    const headers = ["Route No", "Route Name", "Route Code", "Description", "Status"];
    const rows = filteredRoutes.map((route) => [
      route.routeNo.toString(),
      route.routeName,
      route.routeCode || "-",
      route.description || "-",
      route.status,
    ]);
    const filename = `Routes_${new Date().toISOString().split("T")[0]}`;
    exportToExcel("Routes - Master List", headers, rows, filename);
    logAuditEvent("EXPORT_EXCEL", "Routes", undefined, { count: filteredRoutes.length });
    showNotification("Excel exported successfully!", "success");
  };

  const validateRoute = (route: Partial<Route>): string | null => {
    const routeName = route.routeName?.trim() ?? "";

    if (!routeName) {
      return "Please fill all required fields.";
    }
    if (routeName.length < 3) {
      return "Route Name must contain at least 3 characters.";
    }

    const duplicate = routes.some(
      (r) =>
        r.routeName.trim().toLowerCase() === routeName.toLowerCase() &&
        r.id !== editingRoute?.id
    );
    if (duplicate) {
      return "Route Name already exists.";
    }

    return null;
  };

  const handleSaveRoute = async (route: Partial<Route>): Promise<boolean> => {
    const validationError = validateRoute(route);
    if (validationError) {
      showNotification(validationError, "error");
      return false;
    }

    const payload = {
      routeName: route.routeName!.trim(),
      routeCode: route.routeCode?.trim() ?? "",
      description: route.description?.trim() ?? "",
      status: route.status ?? "Active",
    };

    try {
      if (editingRoute) {
        await editRoute(editingRoute.id, { ...payload, routeNo: editingRoute.routeNo });
        logAuditEvent("UPDATE_ROUTE", "Routes", editingRoute.id);
        showNotification("Route updated successfully!", "success");
      } else {
        const list = await addRoute(payload);
        const created = list.find((r) => r.routeName === payload.routeName);
        logAuditEvent("CREATE_ROUTE", "Routes", created?.id);
        showNotification("Route added successfully!", "success");
      }

      setEditingRoute(null);
      setShowDialog(false);
      return true;
    } catch (err) {
      showNotification(handleApiError(err), "error");
      return false;
    }
  };

  const handleEditRoute = (route: Route) => {
    setEditingRoute(route);
    setShowDialog(true);
  };

  const handleDeleteRoute = async (id: number) => {
    if (!window.confirm("Deactivate this route? It will be marked Inactive (history is kept).")) return;
    setDeletingId(id);
    try {
      await removeRoute(id);
      logAuditEvent("DEACTIVATE_ROUTE", "Routes", id);
      showNotification("Route deactivated successfully!", "success");
    } catch (err) {
      showNotification(handleApiError(err), "error");
    } finally {
      setDeletingId(null);
    }
  };

  const content = (
    <div className="w-full space-y-2 route-page-container">
      <style>{`
        .route-page-container button,
        [role="dialog"] button {
          transition: all 0.15s ease-in-out;
        }
        .route-page-container button:hover,
        [role="dialog"] button:hover {
          transform: translateY(-1px);
        }
      `}</style>

      <div className="w-full bg-white rounded-xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/40">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search Route..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  disabled={loading}
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 hover:border-red-300 transition-all"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M8 11a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1zm0 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1zm0 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                PDF
              </button>

              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 hover:border-green-300 transition-all"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm6 0a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1H9a1 1 0 01-1-1V4zm6 0a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
                </svg>
                Excel
              </button>

              <button
                onClick={() => {
                  setEditingRoute(null);
                  setShowDialog(true);
                }}
                disabled={loading || saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-all shadow-sm disabled:opacity-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Route
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600 uppercase tracking-wider">
              Routes Directory
            </span>
            <span className="px-2 py-0.5 font-semibold text-blue-700 bg-blue-50 border border-blue-200/60 rounded-full">
              {filteredRoutes.length} records
            </span>
            {(loading || saving || deletingId !== null) && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 font-medium text-slate-600 bg-slate-100 border border-slate-200 rounded-full">
                <svg className="animate-spin h-3 w-3 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                {loading ? "Loading..." : "Saving..."}
              </span>
            )}
          </div>
          <p className="text-slate-500 font-medium">
            Showing {paginatedRoutes.length} of {filteredRoutes.length} Routes (Page {currentPage} of {totalPages})
          </p>
        </div>

        {error && !loading && (
          <div className="mx-4 mt-3 px-3 py-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => {
                void reload().catch(() => undefined);
              }}
              className="shrink-0 text-xs font-semibold text-red-700 underline"
            >
              Retry
            </button>
          </div>
        )}

        <div className="p-0 relative min-h-[120px]">
          {loading && routes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-3">
              <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-sm font-medium">Loading routes...</p>
            </div>
          ) : !loading && routes.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
              <p className="text-sm font-medium text-slate-700">No routes found.</p>
              <p className="text-xs text-slate-500">Add a route to get started.</p>
            </div>
          ) : (
            <RouteTable
              routes={paginatedRoutes}
              onEdit={handleEditRoute}
              onDelete={(id) => {
                void handleDeleteRoute(id);
              }}
            />
          )}
        </div>

        <div className="px-4 py-2.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1 || loading}
            className="px-2.5 py-1 rounded-md border border-slate-200 bg-white font-medium text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
          >
            Previous
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                disabled={loading}
                className={`w-7 h-7 rounded-md text-xs font-semibold flex items-center justify-center ${
                  currentPage === pageNum
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {pageNum}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages || loading}
            className="px-2.5 py-1 rounded-md border border-slate-200 bg-white font-medium text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
          >
            Next
          </button>
        </div>
      </div>

      <RouteDialog
        open={showDialog}
        onClose={() => {
          setEditingRoute(null);
          setShowDialog(false);
        }}
        onSave={handleSaveRoute}
        route={editingRoute}
      />
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <DashboardLayout>
      <PageLayout className="!py-2 px-8 sm:px-12 lg:px-16 max-w-6xl mx-auto">
        {content}
      </PageLayout>
    </DashboardLayout>
  );
}

export default React.memo(RoutesPage);
