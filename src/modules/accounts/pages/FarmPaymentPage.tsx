import { useState, useEffect, useMemo, useRef } from 'react';
import { toBusinessDate } from '../../../utils/businessDate';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import { FarmPaymentTable } from '../components/farm-payment/FarmPaymentTable';
import { FarmerPaymentFilters } from '../components/farm-payment/FarmerPaymentFilters';
import { listTrips } from '../../operations/vehicle-trips/services/tripHeaderApiService';
import { FarmPaymentTripViewModal } from '../components/farm-payment/FarmPaymentTripViewModal';
import { FarmPaymentService } from '../services/FarmPaymentService';
import { loadTripFarmPayments } from '../services/farmPaymentApiService';
import type { Trip } from '../../operations/vehicle-trips/types/trip';
import type { FarmPayment, TripFarmPayment } from '../types/farmPayment.types';
import { Save, RotateCcw, HandCoins } from 'lucide-react';
import { formatINR, formatINRExact, formatCount, formatKg } from '../components/farm-payment/farmPaymentFormat';
import Pagination from '../../../ui/Pagination';
import { shouldShowPagination } from '../../../shared/ui/paginationStyles';
import { useI18n } from '../../../i18n';

type FarmerPaymentPageProps = { embedded?: boolean };

/**
 * The window this page opens with: the last COMPLETE week, Monday to Sunday.
 * "This week" is still running — its Sunday has not happened yet — so a
 * current-week total always reads as a shortfall. Starting one week back means
 * the table, the totals bar and every trip in it cover the same seven days.
 */
function lastCompleteWeek(): { from: string; to: string } {
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = new Date();
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // getDay: 0=Sun
  const from = new Date(thisMonday);
  from.setDate(thisMonday.getDate() - 7);
  const to = new Date(thisMonday);
  to.setDate(thisMonday.getDate() - 1); // the Sunday that just closed
  return { from: iso(from), to: iso(to) };
}

/** One figure in the totals bar under the table — a compact caption/value pair
    that stays on one line, with the exact rupees in its hover tip. */
function TotalStat({ label, value, exact, dot }: { label: string; value: string; exact?: string; dot: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={exact}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{value}</span>
    </span>
  );
}

export function FarmerPaymentPage({ embedded = false }: FarmerPaymentPageProps) {
  const { t } = useI18n();
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
  // True while a user-initiated refresh is in flight — the finished load
  // confirms with the shared "Data refreshed" toast (the Trip List contract).
  const refreshToastPendingRef = useRef(false);

  // Payment state management
  const [paymentData, setPaymentData] = useState<Record<string, Partial<FarmPayment>>>({});
  const [savingPayments, setSavingPayments] = useState(false);

  // Backend farm payments, one row per completed trip (GET /accounts/farm-payments
  // — the same rows the Account Analysis charges to each trip). Held in a ref
  // because syncPaymentData() also runs after save/reset, where re-reading it
  // from state would risk a stale closure. A locally saved payment still wins:
  // this is the starting point for a trip nobody has edited here yet, not an
  // override of work already saved on this machine.
  const apiFarmByTripRef = useRef<Map<string, TripFarmPayment>>(new Map());

  // Filter states
  // Opens on the last complete week (Mon-Sun); see lastCompleteWeek().
  const [defaultRange] = useState(lastCompleteWeek);
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
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
    const apiFarm = apiFarmByTripRef.current;
    trips.forEach((trip) => {
      const tripId = String(trip.id);
      const existingPayment = FarmPaymentService.getByTripId(tripId);

      if (existingPayment) {
        savedPayments[tripId] = {
          ...existingPayment,
          totalBirds: trip.totalBirds || 0,
          dcWeight: trip.dcWeight || 0,
        };
        return;
      }

      // No local record: fall back to that trip's own backend farm payment so
      // the row opens showing what the trip actually cost instead of blanks.
      const apiRow = apiFarm.get(tripId);
      savedPayments[tripId] = apiRow
        ? {
            tripId,
            totalBirds: trip.totalBirds || apiRow.totalBirds || 0,
            dcWeight: trip.dcWeight || apiRow.dcWeight || 0,
            ratePerKg: apiRow.rate,
            totalAmount: apiRow.amount,
            amountPaid: apiRow.paidAmount,
            balance: apiRow.balance,
            // The page's own vocabulary: the backend's "Pending" is "Unpaid".
            paymentStatus:
              apiRow.status === 'Paid'
                ? 'Paid'
                : apiRow.status === 'Partially Paid'
                  ? 'Partially Paid'
                  : 'Unpaid',
            paidDate: apiRow.paymentDate ?? undefined,
            paymentMode: (apiRow.paymentMode as FarmPayment['paymentMode']) ?? undefined,
            notes: apiRow.referenceNo ? `Ref ${apiRow.referenceNo}` : undefined,
          }
        : {
            tripId,
            totalBirds: trip.totalBirds || 0,
            dcWeight: trip.dcWeight || 0,
            paymentStatus: 'Unpaid',
          };
    });
    setPaymentData(savedPayments);
  };

  useEffect(() => {
    let cancelled = false;
    // Trips and their farm payments load together. A farm ledger that fails to
    // answer must never blank the trip list, so it degrades to an empty map and
    // the rows simply open without a pre-filled payment.
    Promise.all([listTrips(), loadTripFarmPayments().catch(() => [] as TripFarmPayment[])])
      .then(([all, farmRows]) => {
        if (cancelled) return; // superseded — drop the stale response
        apiFarmByTripRef.current = new Map(farmRows.map((row) => [String(row.tripId), row]));
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
      .then(() => {
        // The Trip List's refresh contract: a user-initiated refresh confirms
        // with the shared "Data refreshed" success toast once it lands.
        if (!cancelled && refreshToastPendingRef.current) {
          refreshToastPendingRef.current = false;
          showNotification(t('notification.data_refreshed'), 'success');
        }
      })
      .catch((error) => {
        if (cancelled) return; // superseded — ignore
        console.error('Failed to load trips:', error);
        refreshToastPendingRef.current = false;
        // Keep any previously loaded rows visible; surface the failure both
        // as a toast and as an inline state (the table alone would otherwise
        // read as "no completed trips", misleading on a fetch error).
        setLoadError(t('accounts.farmpay.load_error'));
        showNotification(t('accounts.farmpay.notif_load_error'), 'error');
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
      showNotification(t('accounts.farmpay.notif_no_changes'), 'info');
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

      showNotification(
        savedCount === 1
          ? t('accounts.farmpay.notif_saved_one')
          : t('accounts.farmpay.notif_saved_many', { count: savedCount }),
        'success'
      );

    } catch (error) {
      console.error('Failed to save payments:', error);
      showNotification(t('accounts.farmpay.notif_save_failed'), 'error');
    } finally {
      setSavingPayments(false);
    }
  };

  const handleResetPayments = () => {
    // "Nothing to reset" means nothing was edited this session — paymentData is
    // never empty now that rows open pre-filled from the backend.
    if (dirtyTripIds.size === 0) {
      showNotification(t('accounts.farmpay.notif_nothing_reset'), 'info');
      return;
    }
    clearDirty();
    // Instant local sync from persisted payments — no reload.
    syncPaymentData(allTrips);
    showNotification(t('accounts.farmpay.notif_reset'), 'info');
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
    refreshToastPendingRef.current = true;
    setLoading(true);
    setLoadError(null);
    setRefreshKey(prev => prev + 1);
  };

  const handleClearFilters = () => {
    // Clear means "back to the default week", not "every trip ever".
    setDateFrom(defaultRange.from);
    setDateTo(defaultRange.to);
    setSelectedFarm('All');
    setSearchQuery('');
    setCurrentPage(1);
    showNotification(t('accounts.farmpay.notif_filters_cleared'), 'info');
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

  // The page always opens on a real week, so "filtered" means: something the
  // user changed. Only then does the totals bar appear under the table.
  const isFilterActive = Boolean(
    (dateFrom && dateFrom !== defaultRange.from) ||
      (dateTo && dateTo !== defaultRange.to) ||
      selectedFarm !== 'All' ||
      searchQuery.trim()
  );

  // ----- render -----
  const content = (
    <div className={`w-full space-y-5 animate-in fade-in duration-200 ${
      embedded ? '' : 'px-3 md:px-6 py-4 bg-slate-50/50 min-h-screen text-slate-800'
    }`}>
      {/* The same filter card the Trip List uses: icon-labelled fields, the
          search row, Reset (spins) and the brand hen Refresh. Filters apply
          reactively — no Apply step. */}
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
        loading={loading}
        onRefresh={handleRefresh}
        onClear={handleClearFilters}
      />

      {/* The table card — the exact shell the Trip List uses: white rounded-2xl
          card, gradient header bar with the logo tile + title + live count,
          register actions on the right, table, global pagination at the foot. */}
      <section
        aria-label={t('accounts.farmpay.records_aria')}
        aria-busy={loading}
        className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden text-xs md:text-sm"
      >
        {/* Header — the Trip List header: logo tile + heading + count badge,
            with the register's Save / Reset actions on the right. */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 px-6 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-50/60 via-white to-blue-50/40">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-center text-emerald-500 shadow-inner">
                <HandCoins className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-800 tracking-tight">{t('accounts.farmpay.title')}</h3>
            </div>
            <span
              aria-live="polite"
              className="inline-flex items-center justify-center px-2.5 py-0.5 text-xs font-semibold text-slate-600 bg-slate-100 border border-slate-200/80 rounded-full shadow-sm tabular-nums"
            >
              {loading ? t('accounts.farmpay.updating') : filteredTrips.length}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto lg:justify-end">
            <button
              onClick={handleResetPayments}
              disabled={modifiedCount === 0}
              className="group px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-1.5"
            >
              <span className={`inline-flex ${modifiedCount > 0 ? 'motion-safe:group-hover:animate-[var(--animate-action-reset)]' : ''}`}>
                <RotateCcw size={14} />
              </span>
              {t('common.reset')}
            </button>
            <button
              onClick={handleSaveAll}
              disabled={savingPayments || loading || modifiedCount === 0}
              className="group px-4 py-1.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white rounded-lg text-xs font-semibold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingPayments ? (
                <>
                  <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
                  {t('accounts.payment.saving')}
                </>
              ) : (
                <>
                  <span className={`inline-flex ${modifiedCount > 0 ? 'motion-safe:group-hover:animate-[var(--animate-action-approve)]' : ''}`}>
                    <Save size={14} />
                  </span>
                  {t('common.save')}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Table — the animated "Loading Farm Payment records…" state renders
            through the table itself (the Trip List's contract) whenever a load
            is in flight; a refresh with rows on screen keeps them visible. */}
        {loadError && allTrips.length === 0 && !loading ? (
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
              {t('accounts.farmpay.try_again')}
            </button>
          </div>
        ) : (
          <>
            <FarmPaymentTable
              trips={paginatedTrips}
              paymentData={paymentData}
              onPaymentUpdate={handlePaymentUpdate}
              loading={loading && allTrips.length === 0}
              onViewTrip={setViewingTrip}
              startIndex={(currentPage - 1) * pageSize}
              emptyMessage={
                isFilterActive
                  ? t('accounts.farmpay.empty_no_filters')
                  : t('accounts.farmpay.empty_no_data')
              }
            />

            {/* Totals bar — the last strip of the table, only once the view is
                narrowed away from the default week. */}
            {isFilterActive && filteredTrips.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-slate-200/70 bg-slate-50/80 px-4 py-2">
                <p className="text-[11px] font-semibold text-slate-500">
                  {t('accounts.farmpay.totals_for', { count: filteredTrips.length })}
                </p>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                  <TotalStat label={t('accounts.farmpay.total_birds')} value={formatCount(totalBirdsKPI)} dot="bg-indigo-500" />
                  <TotalStat label={t('accounts.farmpay.total_weight')} value={`${formatKg(totalWeightKPI)} kg`} dot="bg-lime-500" />
                  <TotalStat
                    label={t('accounts.farmpay.total_amount')}
                    value={formatINR(totalAmountKPI)}
                    exact={formatINRExact(totalAmountKPI)}
                    dot="bg-emerald-500"
                  />
                </div>
              </div>
            )}

            {/* Global pagination, exactly as the Trip List renders it: the
                shared component, shown only when there is more than one page,
                blocked while a refresh is in flight. */}
            {shouldShowPagination(filteredTrips.length) && (
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
                ariaLabel={t('accounts.farmpay.records_aria')}
              />
            )}
          </>
        )}
      </section>

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