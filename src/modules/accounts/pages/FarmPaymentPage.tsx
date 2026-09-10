import { useState, useEffect, useMemo, useRef } from 'react';
import { toBusinessDate } from '../../../utils/businessDate';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import { FarmPaymentTable } from '../components/farm-payment/FarmPaymentTable';
import { FarmerPaymentFilters } from '../components/farm-payment/FarmerPaymentFilters';
import { listTrips } from '../../operations/vehicle-trips/services/tripHeaderApiService';
import { FarmPaymentTripViewModal } from '../components/farm-payment/FarmPaymentTripViewModal';
import { FarmPaymentService } from '../services/FarmPaymentService';
import type { Trip } from '../../operations/vehicle-trips/types/trip';
import type { FarmPayment } from '../types/farmPayment.types';
import { Save, RotateCcw, RefreshCw, Bird, Gauge, Banknote } from 'lucide-react';
import { formatINR, formatINRExact, formatCount } from '../components/farm-payment/farmPaymentFormat';
import Pagination from '../../../ui/Pagination';

type FarmerPaymentPageProps = { embedded?: boolean };

type KpiTone = 'indigo' | 'lime' | 'emerald';

// Full class strings (never assembled from a template) so Tailwind's scanner keeps them.
const KPI_TONE: Record<KpiTone, { tile: string; rule: string }> = {
  indigo: { tile: 'bg-indigo-50 text-indigo-700 ring-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/20', rule: 'from-indigo-500/25' },
  lime: { tile: 'bg-lime-50 text-lime-700 ring-lime-100 dark:bg-lime-500/10 dark:text-lime-300 dark:ring-lime-500/20', rule: 'from-lime-500/25' },
  emerald: { tile: 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20', rule: 'from-emerald-500/25' },
};

/** Same card shell as the Accounts Dashboard KPIs: accent rule, icon tile,
    compact figure on screen with the exact rupees in its hover tip. */
function FarmKpiCard({
  tone,
  icon: Icon,
  label,
  sub,
  value,
  valueExact,
  footer,
}: {
  tone: KpiTone;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  label: string;
  sub?: string;
  value: string;
  valueExact?: string;
  footer?: string;
}) {
  const t = KPI_TONE[tone];
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700">
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${t.rule} to-transparent`} />
      <div className="flex items-start gap-2.5">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ${t.tile}`}>
          <Icon size={16} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">{label}</p>
          {sub && <p className="mt-0.5 truncate text-[11px] leading-none text-slate-400 dark:text-slate-500">{sub}</p>}
        </div>
      </div>
      <p className="mt-3 text-[22px] font-bold leading-none tracking-tight text-slate-900 dark:text-white" title={valueExact}>
        {value}
      </p>
      {footer && <p className="mt-2 text-[10px] font-semibold text-slate-500 dark:text-slate-400">{footer}</p>}
    </div>
  );
}

export function FarmerPaymentPage({ embedded = false }: FarmerPaymentPageProps) {
  const { showNotification } = useSafeNotification();

  // ----- state -----
  const [allTrips, setAllTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Timestamp of the last initiated refresh: a double-click on Refresh is one
  // user intent, so a second click within 500ms is ignored instead of firing
  // a duplicate fetch (fast responses already reset `loading` between clicks).
  const lastRefreshAtRef = useRef(0);

  // Payment state management
  const [paymentData, setPaymentData] = useState<Record<string, Partial<FarmPayment>>>({});
  const [savingPayments, setSavingPayments] = useState(false);

  // Filter states
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedFarm, setSelectedFarm] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination (global <Pagination /> bar — page size is user-selectable)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Trip opened in the read-only trip view modal (per-row eye button).
  const [viewingTrip, setViewingTrip] = useState<Trip | null>(null);

  // Trip IDs whose payment the user edited since the last load/save. Only
  // these rows are saved by "Save Payments" — rows restored from a previous
  // save are untouched, so the toast count always matches what was just
  // entered (editing one row after a save saves exactly one payment).
  const [dirtyTripIds, setDirtyTripIds] = useState<Set<string>>(() => new Set());
  const markDirty = (tripId: string) =>
    setDirtyTripIds((prev) => {
      if (prev.has(tripId)) return prev;
      const next = new Set(prev);
      next.add(tripId);
      return next;
    });
  const clearDirty = () => setDirtyTripIds(new Set());

  // ----- load data -----
  // Completed trips are backend-authoritative (GET /api/trips — the same
  // source of truth as Trip List / Recent Trips). Trips completed through the
  // wizard or the Pending → Completed approval flow are persisted by the
  // backend and never written to the legacy localStorage key, so the Farm
  // Payment page must read them from the API to see every completed trip.
  //
  // setState only ever runs in .then/.catch/.finally callbacks (never
  // synchronously in the effect body), and the `cancelled` cleanup flag drops
  // superseded responses: if a newer load starts while a request is in
  // flight, the stale response can never overwrite the newer state.

  // Rebuild paymentData from persisted payments for the given trips — a pure
  // local sync with NO network call and NO loading spinner. Used after save
  // and reset (saving payments never changes the trip list, so a full reload
  // would just flash "Loading trips..." for nothing) and by loadCompletedTrips.
  const syncPaymentData = (trips: Trip[]) => {
    const savedPayments: Record<string, Partial<FarmPayment>> = {};
    trips.forEach((trip) => {
      const tripId = String(trip.id);
      const existingPayment = FarmPaymentService.getByTripId(tripId);

      if (existingPayment) {
        savedPayments[tripId] = {
          ...existingPayment,
          totalBirds: trip.totalBirds || 0,
          dcWeight: trip.dcWeight || 0,
        };
      } else {
        savedPayments[tripId] = {
          tripId,
          totalBirds: trip.totalBirds || 0,
          dcWeight: trip.dcWeight || 0,
          paymentStatus: 'Unpaid',
        };
      }
    });
    setPaymentData(savedPayments);
  };

  useEffect(() => {
    let cancelled = false;
    listTrips()
      .then((all) => {
        if (cancelled) return; // superseded — drop the stale response
        setLoadError(null);

        const completed = all
          .filter((t) => {
            const isCompleted = t.status === 'Completed';
            const notDeleted = !t.deleted;
            const pickupSubmitted = t.pickupStepSubmitted === true;
            return isCompleted && notDeleted && pickupSubmitted;
          })
          .sort(
            // Deterministic order: newest date first, then highest trip id,
            // so same-date trips never shuffle between refreshes.
            (a, b) =>
              b.tripDate.localeCompare(a.tripDate) || (b.id as number) - (a.id as number)
          );

        setAllTrips(completed);
        syncPaymentData(completed);
        // paymentData now mirrors persisted storage — nothing is unsaved.
        clearDirty();
      })
      .catch((error) => {
        if (cancelled) return; // superseded — ignore
        console.error('Failed to load trips:', error);
        // Keep any previously loaded rows visible; surface the failure both
        // as a toast and as an inline state (the table alone would otherwise
        // read as "no completed trips", misleading on a fetch error).
        setLoadError('Failed to load trips. Please try refreshing.');
        showNotification('Failed to load trips', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  // Any filter change returns the view to page 1 (otherwise page 5 of a
  // narrowed result set would be a stranded empty page). Done as a render-
  // phase adjustment — the React-documented pattern for resetting derived
  // state — instead of an extra cascading render from an effect.
  const filterSignature = `${dateFrom}|${dateTo}|${selectedFarm}|${searchQuery}`;
  const [lastFilterSignature, setLastFilterSignature] = useState(filterSignature);
  if (filterSignature !== lastFilterSignature) {
    setLastFilterSignature(filterSignature);
    setCurrentPage(1);
  }

  // ----- compute unique farms -----
  const farms = useMemo(() => {
    const farmSet = new Set(allTrips.map((t) => t.sourceFarm).filter(Boolean));
    return ['All', ...Array.from(farmSet)];
  }, [allTrips]);

  // ----- filter trips -----
  const filteredTrips = useMemo(() => {
    return allTrips.filter((trip) => {
      if (dateFrom && trip.tripDate < dateFrom) return false;
      if (dateTo && trip.tripDate > dateTo) return false;
      if (selectedFarm !== 'All' && trip.sourceFarm !== selectedFarm) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          trip.tripNo.toLowerCase().includes(q) ||
          trip.vehicleNo.toLowerCase().includes(q) ||
          trip.sourceFarm.toLowerCase().includes(q) ||
          trip.driverName.toLowerCase().includes(q) ||
          trip.supervisorName.toLowerCase().includes(q);
        if (!match) return false;
      }

      return true;
    });
  }, [allTrips, dateFrom, dateTo, selectedFarm, searchQuery]);

  // ----- compute KPI totals (based on filtered trips) -----
  const totalBirdsKPI = useMemo(() => {
    return filteredTrips.reduce((sum, trip) => sum + (trip.totalBirds || 0), 0);
  }, [filteredTrips]);

  const totalWeightKPI = useMemo(() => {
    return filteredTrips.reduce((sum, trip) => sum + (trip.dcWeight || 0), 0);
  }, [filteredTrips]);

  const totalAmountKPI = useMemo(() => {
    return filteredTrips.reduce((sum, trip) => {
      const payment = paymentData[String(trip.id)];
      const ratePerKg = payment?.ratePerKg || 0;
      // Same weight-based pricing the table shows live, so the card and the
      // column it adds up can never disagree.
      return sum + (payment?.totalAmount || (trip.dcWeight || 0) * ratePerKg);
    }, 0);
  }, [filteredTrips, paymentData]);

  // Per-trip / per-kg context for the cards (never divide by zero).
  const tripCount = Math.max(1, filteredTrips.length);

  // ----- pagination -----
  // ----- pagination (global <Pagination /> handles clamping + windows) -----
  const paginatedTrips = useMemo(
    () => filteredTrips.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredTrips, currentPage, pageSize]
  );

  // ----- payment handlers -----
  const handlePaymentUpdate = (tripId: string, updates: Partial<FarmPayment>) => {
    markDirty(tripId);
    setPaymentData((prev) => {
      const existing = prev[tripId] || {};
      return {
        ...prev,
        [tripId]: {
          ...existing,
          ...updates,
          tripId,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  const handleSaveAll = async () => {
    // Re-entrancy guard: the button is disabled while saving, but this makes
    // double-submission impossible even via keyboard/rapid re-entry.
    if (savingPayments) return;

    // Save ONLY the rows edited in this session (see dirtyTripIds). A row
    // restored from a previous save keeps its rate fields, so filtering on
    // "has a rate" alone would re-save old payments and inflate the count.
    const paymentsToSave = Object.entries(paymentData).filter(([tripId, payment]) => {
      if (!dirtyTripIds.has(tripId)) return false;
      return (payment.ratePerKg ?? 0) > 0 || (payment.totalAmount ?? 0) > 0;
    });

    if (paymentsToSave.length === 0) {
      showNotification('No payment changes to save. Please fill in payment details first.', 'info');
      return;
    }

    setSavingPayments(true);

    try {
      let savedCount = 0;

      for (const [tripId, paymentDataItem] of paymentsToSave) {
        const trip = allTrips.find(t => String(t.id) === tripId);
        if (!trip) continue;

        const totalBirdsLoaded = trip.totalBirds || 0;
        const dcWeight = trip.dcWeight || 0;
        const ratePerKg = paymentDataItem.ratePerKg || 0;
        // Weight-based pricing: Rate/Kg × DC weight.
        const totalAmount = paymentDataItem.totalAmount || dcWeight * ratePerKg;

        const finalPayment: FarmPayment = {
          ...paymentDataItem,
          tripId,
          totalBirds: totalBirdsLoaded,
          dcWeight: dcWeight,
          totalAmount,
          amountPaid: paymentDataItem.amountPaid || 0,
          balance: totalAmount - (paymentDataItem.amountPaid || 0),
          // The record keeps whatever status it already had (Payment Book owns
          // settlements); this page only sets the rate, so it never labels a
          // row paid/unpaid.
          paymentStatus: paymentDataItem.paymentStatus || 'Unpaid',
          paidDate: paymentDataItem.paidDate || toBusinessDate(new Date()),
          paymentMode: paymentDataItem.paymentMode || 'Cash',
          createdAt: paymentDataItem.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        const existing = FarmPaymentService.getByTripId(tripId);
        if (existing) {
          FarmPaymentService.updatePayment(tripId, finalPayment);
        } else {
          FarmPaymentService.createPayment(finalPayment);
        }

        savedCount++;
      }

      // Instant local sync — no refetch, no loading spinner. Saving payments
      // never changes the completed-trip list, so a full reload is unnecessary;
      // paymentData is rebuilt from the just-persisted FarmPaymentService.
      syncPaymentData(allTrips);
      clearDirty();

      const paymentWord = savedCount === 1 ? 'payment' : 'payments';
      showNotification(`${savedCount} ${paymentWord} saved successfully`, 'success');

    } catch (error) {
      console.error('Failed to save payments:', error);
      showNotification('Failed to save payments. Please try again.', 'error');
    } finally {
      setSavingPayments(false);
    }
  };

  const handleResetPayments = () => {
    if (Object.keys(paymentData).length === 0) {
      showNotification('No changes to reset', 'info');
      return;
    }
    clearDirty();
    // Instant local sync from persisted payments — no reload.
    syncPaymentData(allTrips);
    showNotification('All changes reset', 'info');
  };

  const handleRefresh = () => {
    // One click = one request: ignore clicks while a load is already running,
    // and treat double-clicks as a single refresh intent (500ms window).
    // Loading/error flags are set here (event handler) — the load effect
    // itself never sets state synchronously.
    if (loading) return;
    const now = Date.now();
    if (now - lastRefreshAtRef.current < 500) return;
    lastRefreshAtRef.current = now;
    setLoading(true);
    setLoadError(null);
    setRefreshKey(prev => prev + 1);
    showNotification('Refreshed', 'info');
  };

  const handleClearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedFarm('All');
    setSearchQuery('');
    setCurrentPage(1);
    showNotification('Filters cleared', 'info');
  };

  // Unsaved rows = edited since the last load/save (same set Save Payments
  // persists), so the Save/Reset buttons enable exactly when there is
  // something new to save — never for rows restored from a previous save.
  const modifiedCount = useMemo(() => {
    return Object.entries(paymentData).filter(([tripId, payment]) => {
      if (!dirtyTripIds.has(tripId)) return false;
      return (payment.ratePerKg ?? 0) > 0 || (payment.totalAmount ?? 0) > 0;
    }).length;
  }, [paymentData, dirtyTripIds]);

  // Check if any filter is active
  const isFilterActive = dateFrom || dateTo || selectedFarm !== 'All' || searchQuery;

  // ----- render -----
  const content = (
    <div className={`w-full space-y-5 animate-in fade-in duration-500 ${
      embedded ? '' : 'px-4 md:px-8 py-6 md:py-8 bg-slate-50 min-h-screen'
    }`}>
      {/* Filters */}
      <FarmerPaymentFilters
        dateFrom={dateFrom}
        dateTo={dateTo}
        selectedFarm={selectedFarm}
        searchQuery={searchQuery}
        farms={farms}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onFarmChange={setSelectedFarm}
        onSearchChange={setSearchQuery}
        onApply={() => setCurrentPage(1)}
        onClear={handleClearFilters}
      />

      {/* KPIs — the three totals this page is actually about */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <FarmKpiCard
          tone="indigo" icon={Bird} label="Total Birds"
          sub={`${filteredTrips.length} ${filteredTrips.length === 1 ? 'trip' : 'trips'} in view`}
          value={formatCount(totalBirdsKPI)}
          footer={`${formatCount(totalBirdsKPI / tripCount)} birds / trip`}
        />
        <FarmKpiCard
          tone="lime" icon={Gauge} label="Total Weight"
          sub={`${(totalWeightKPI / (totalBirdsKPI || 1)).toFixed(1)} kg avg per bird`}
          value={`${totalWeightKPI.toFixed(1)} kg`}
          footer={`${(totalWeightKPI / tripCount).toFixed(1)} kg / trip`}
        />
        <FarmKpiCard
          tone="emerald" icon={Banknote} label="Total Amount"
          sub={`₹${(totalAmountKPI / (totalWeightKPI || 1)).toFixed(2)} per kg`}
          value={formatINR(totalAmountKPI)} valueExact={formatINRExact(totalAmountKPI)}
          footer={`${formatINR(totalAmountKPI / tripCount)} / trip`}
        />
      </div>

      {/* Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {/* Header with Save button */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-gradient-to-r from-slate-50/80 to-white border-b border-slate-200/60">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-800">Farm Payments</h2>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              {filteredTrips.length} {filteredTrips.length === 1 ? 'trip' : 'trips'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5"
              title="Reload completed trips from the backend"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button
              onClick={handleResetPayments}
              disabled={modifiedCount === 0}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5"
            >
              <RotateCcw size={14} /> Reset
            </button>
            <button
              onClick={handleSaveAll}
              disabled={savingPayments || loading || modifiedCount === 0}
              className="px-4 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingPayments ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save size={14} /> Save
                </>
              )}
            </button>
          </div>
        </div>

        {/* Table — the full spinner shows only on the FIRST load (no data yet).
            A refresh keeps the current rows on screen (no flicker / no input
            loss); the spinning Refresh icon signals activity. */}
        {loading && allTrips.length === 0 && !loadError ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
            <p className="mt-3 text-slate-500 text-sm">Loading trips...</p>
          </div>
        ) : loadError && allTrips.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-semibold text-red-600">{loadError}</p>
            <button
              onClick={() => {
                if (loading) return;
                setLoading(true);
                setLoadError(null);
                setRefreshKey(prev => prev + 1);
              }}
              className="mt-3 px-4 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 transition"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            <FarmPaymentTable
              trips={paginatedTrips}
              paymentData={paymentData}
              onPaymentUpdate={handlePaymentUpdate}
              onPaymentSaved={handleSaveAll}
              onRefresh={handleRefresh}
              showNotification={showNotification}
              onViewTrip={setViewingTrip}
              emptyMessage={
                isFilterActive
                  ? 'No trips match the current filters.'
                  : 'No completed trips found'
              }
            />

            {/* Global pagination bar — identical appearance/behaviour app-wide */}
            <Pagination
              page={currentPage}
              pageSize={pageSize}
              totalItems={filteredTrips.length}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              disabled={loading}
              ariaLabel="Farm payment pagination"
            />
          </>
        )}
      </div>

      {/* Separate read-only trip view — Step 2 (Farm) + Step 3 (Pickup) only,
          same step detail as the Trip List view. */}
      <FarmPaymentTripViewModal
        open={Boolean(viewingTrip)}
        trip={viewingTrip}
        onClose={() => setViewingTrip(null)}
      />
    </div>
  );

  return content;
}