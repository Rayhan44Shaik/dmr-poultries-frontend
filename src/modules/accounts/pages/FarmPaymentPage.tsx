import { useState, useEffect, useMemo, useRef } from 'react';
import { toBusinessDate } from '../../../utils/businessDate';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import { FarmPaymentTable } from '../components/farm-payment/FarmPaymentTable';
import { FarmerPaymentFilters } from '../components/farm-payment/FarmerPaymentFilters';
import { listTrips, loadTripById } from '../../operations/vehicle-trips/services/tripHeaderApiService';
import { FarmPaymentTripViewModal } from '../components/farm-payment/FarmPaymentTripViewModal';
import { flattenFarmPaymentsForTable, loadTripFarmPayments, saveTripFarmPayments, toFarmPaymentExportRows } from '../services/farmPaymentApiService';
import type { FarmPaymentDisplayRow, TripFarmPaymentSaveInput } from '../services/farmPaymentApiService';
import { farmPaymentRowDetails, isFarmPaymentTrip, mergeFarmPaymentRows, useQuietRefreshSignal } from '../utils/farmPaymentSync';
import type { Trip } from '../../operations/vehicle-trips/types/trip';
import type { FarmPayment, TripFarmPayment } from '../types/farmPayment.types';
import { Save, RotateCcw, HandCoins, FileText, FileSpreadsheet, LoaderCircle } from 'lucide-react';
import { formatINR, formatINRExact, formatCount, formatKg } from '../components/farm-payment/farmPaymentFormat';
import Pagination from '../../../ui/Pagination';
import { shouldShowPagination } from '../../../shared/ui/paginationStyles';
import { useI18n } from '../../../i18n';
import type { FarmPaymentExportRow } from '../utils/farmPaymentExport';

/** Pull a bare reference out of the legacy "Ref …" notes form field. */
function referenceFromNotes(notes?: string): string | undefined {
  if (!notes) return undefined;
  const match = /^Ref\s+(.+)$/i.exec(notes.trim());
  return match?.[1]?.trim() || undefined;
}

/** Map one API farm-payment row into the page's in-memory form shape. */
function formFromApiRow(trip: Trip, apiRow?: TripFarmPayment): Partial<FarmPayment> {
  const tripId = String(trip.id);
  if (!apiRow) {
    const submittedLoads = (trip.legs ?? []).filter((leg) => leg.pickupStepSubmitted);
    return {
      tripId,
      farmName: submittedLoads.length
        ? [...new Set(submittedLoads.map((leg) => leg.sourceFarm).filter(Boolean))].join(', ')
        : trip.sourceFarm,
      birdType: submittedLoads.length
        ? [...new Set(submittedLoads.map((leg) => leg.farmBirdType).filter(Boolean))].join(', ')
        : trip.birdType,
      totalBirds: submittedLoads.length
        ? submittedLoads.reduce((sum, leg) => sum + Number(leg.totalBirds ?? 0), 0)
        : trip.totalBirds || 0,
      dcWeight: submittedLoads.length
        ? submittedLoads.reduce((sum, leg) => sum + Number(leg.dcWeight ?? 0), 0)
        : trip.dcWeight || 0,
      paymentStatus: 'Unpaid',
    };
  }
  return {
    tripId,
    farmName: apiRow.farmName ?? trip.sourceFarm,
    birdType: apiRow.birdType ?? trip.birdType,
    ...farmPaymentRowDetails(trip, apiRow),

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
    loads: apiRow.loads ?? [],
  };
}

type FarmerPaymentPageProps = { embedded?: boolean };

/**
 * No default date window — every completed trip shows on open, like Trip List.
 * Picking From/To narrows the list date-wise; the totals bar appears only then.


 */
function emptyRange(): { from: string; to: string } {
  // No default window: every completed trip shows on open, like Trip List.




  return { from: '', to: '' };
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
  const [refreshKey, setRefreshKey] = useState(0); useQuietRefreshSignal(setRefreshKey);

  // Timestamp of the last initiated refresh: a double-click on Refresh is one
  // user intent, so a second click within 500ms is ignored instead of firing
  // a duplicate fetch (fast responses already reset `loading` between clicks).
  const lastRefreshAtRef = useRef(0); const dirtyTripIdsRef = useRef<Set<string>>(new Set());
  // True while a user-initiated refresh is in flight — the finished load
  // confirms with the shared "Data refreshed" toast (the Trip List contract).
  const refreshToastPendingRef = useRef(false);

  // Payment state management
  const [paymentData, setPaymentData] = useState<Record<string, Partial<FarmPayment>>>({});
  const [savingPayments, setSavingPayments] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);

  // Backend farm payments, one row per completed trip (GET /accounts/farm-payments
  // — the same rows the Account Analysis charges to each trip). Held in a ref
  // because syncPaymentData() also runs after save/reset, where re-reading it
  // from state would risk a stale closure. API rows are the sole source of
  // truth for what each trip opens with.
  const apiFarmByTripRef = useRef<Map<string, TripFarmPayment>>(new Map());
  // Render-safe snapshot of the API ledger (mirrors apiFarmByTripRef, which
  // event handlers read directly). Memos must read state, never a ref.
  const [apiLedger, setApiLedger] = useState<TripFarmPayment[]>([]);
  // Canonical parent trips by id for load-row filtering and the Trip view.
  const tripByIdRef = useRef<Map<string, Trip>>(new Map());

  // Filter states
  // Opens on the last 14 days (through today); see recentTripsRange().
  const [defaultRange] = useState(emptyRange);
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [selectedFarm, setSelectedFarm] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination (global <Pagination /> bar — page size is user-selectable)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Trip opened in the read-only trip view modal (per-row eye button).
  // The displayed -L1/-L2 suffix never leaves the page: the modal always
  // opens the canonical parent trip, highlighting the row's load when known.
  const [viewingTrip, setViewingTrip] = useState<Trip | null>(null); const [viewingLoad, setViewingLoad] = useState<number | null>(null); const viewRequestSeqRef = useRef(0); const handleViewTrip = (row: FarmPaymentDisplayRow) => { const trip = tripByIdRef.current.get(String(row.tripId)); if (!trip) return; const seq = viewRequestSeqRef.current + 1; viewRequestSeqRef.current = seq; setViewingLoad(row.load ?? null); setViewingTrip(trip); void loadTripById(trip.id).then((loaded) => { if (viewRequestSeqRef.current === seq) setViewingTrip(loaded); }).catch(() => { if (viewRequestSeqRef.current === seq) showNotification(t('ops.trip.refresh_failed_using_cached'), 'info'); }); };

  // Display-row keys edited since the last load/save: `trip:${id}` for a
  // single/legacy row, `trip:${id}:leg:${legId}` for a multi-load row. Only
  // these rows are saved by "Save Payments" — rows restored from a previous
  // save are untouched, so the toast count always matches what was just
  // entered (editing one load after a save saves exactly one load).
  const [dirtyTripIds, setDirtyTripIds] = useState<Set<string>>(() => new Set());
  const markDirty = (rowKey: string) =>
    setDirtyTripIds((prev) => {
      if (prev.has(rowKey)) return prev;
      const next = new Set(prev); dirtyTripIdsRef.current.add(rowKey);
      next.add(rowKey);
      return next;
    });
  const clearDirty = () => { dirtyTripIdsRef.current = new Set(); setDirtyTripIds(new Set()); };

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

  // Rebuild paymentData from the API ledger for the given trips — a pure
  // local sync with NO network call and NO loading spinner. Used after save
  // and reset (saving payments never changes the trip list, so a full reload
  // would just flash "Loading trips..." for nothing) and by loadCompletedTrips.
  const syncPaymentData = (trips: Trip[]) => {
    const savedPayments: Record<string, Partial<FarmPayment>> = {};
    const apiFarm = apiFarmByTripRef.current;
    trips.forEach((trip) => {
      savedPayments[String(trip.id)] = formFromApiRow(trip, apiFarm.get(String(trip.id)));
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
        setApiLedger(farmRows);
        setLoadError(null);

        const completed = all
          .filter((t) => {



            return isFarmPaymentTrip(t);
          })
          .sort(
            // Deterministic order: newest date first, then highest trip id,
            // so same-date trips never shuffle between refreshes.
            (a, b) =>
              b.tripDate.localeCompare(a.tripDate) || (b.id as number) - (a.id as number)
          );

        setAllTrips(completed);
        tripByIdRef.current = new Map(completed.map((t) => [String(t.id), t]));
        // The merge works on trip ids; the dirty set holds display-row keys.
        const tripDirtyForMerge = new Set<string>();
        dirtyTripIdsRef.current.forEach((key) => {
          const match = /^trip:(\d+)/.exec(key);
          if (match) tripDirtyForMerge.add(match[1]);
        });
        setPaymentData((prev) => mergeFarmPaymentRows(prev, completed, apiFarmByTripRef.current, tripDirtyForMerge, formFromApiRow));
        // Dirty rows are preserved by the merge above — flags stay until save/reset.

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

  // ----- parent ledger rows (one per trip) → payable display rows -----
  // The page edits parent form state (paymentData) exactly as before; these
  // memos project it — together with the authoritative API ledger — into one
  // display row per payable load for the table, filters, pagination, totals
  // and exports. Account Analysis keeps reading the parent records.
  const round2 = (n: number): number => Math.round(n * 100) / 100;

  const tripById = useMemo(() => new Map(allTrips.map((t) => [String(t.id), t])), [allTrips]);

  const parentRows = useMemo<TripFarmPayment[]>(() => {
    const apiFarm = new Map(apiLedger.map((row) => [String(row.tripId), row]));
    return allTrips.map((trip) => {
      const tripKey = String(trip.id);
      const apiRow = apiFarm.get(tripKey);
      const form = paymentData[tripKey];
      const formLoads = form?.loads && form.loads.length > 0 ? form.loads : null;
      const apiLoads = apiRow?.loads && apiRow.loads.length > 0 ? apiRow.loads : null;
      const submittedLegs = (trip.legs ?? []).filter((leg) => leg.pickupStepSubmitted);
      const sourceLoads = formLoads ?? apiLoads ?? submittedLegs.map((leg) => ({
        legId: leg.id ?? null,
        load: leg.legIndex,
        farmName: leg.sourceFarm ?? null,
        birdType: leg.farmBirdType ?? null,
        totalBirds: Number(leg.totalBirds ?? 0),
        dcWeight: Number(leg.dcWeight ?? 0),
        rate: null,
        amount: null,
      }));
      const parentRate = Number(form?.ratePerKg ?? apiRow?.rate ?? 0);
      const safeParentRate = Number.isFinite(parentRate) ? parentRate : 0;
      const loads = sourceLoads.map((load) => {
        const rate = Number(load.rate ?? safeParentRate ?? 0);
        const safeRate = Number.isFinite(rate) ? rate : 0;
        const rawAmount = load.amount == null ? NaN : Number(load.amount);
        const amount = Number.isFinite(rawAmount)
          ? Math.round(rawAmount * 100) / 100
          : round2(Number(load.dcWeight ?? 0) * safeRate);
        return {
          legId: load.legId ?? null,
          load: load.load,
          farmName: load.farmName ?? null,
          birdType: load.birdType ?? null,
          totalBirds: Number(load.totalBirds ?? 0),
          dcWeight: Number(load.dcWeight ?? 0),
          rate: safeRate,
          amount,
        };
      });
      const amount = loads.length > 1
        ? round2(loads.reduce((sum, load) => sum + load.amount, 0))
        : Number(form?.totalAmount ?? apiRow?.amount ?? 0);
      return {
        id: Number(trip.id),
        tripId: Number(trip.id),
        tripNo: trip.tripNo,
        tripDate: trip.tripDate,
        farmId: apiRow?.farmId,
        farmName: form?.farmName ?? apiRow?.farmName ?? trip.sourceFarm,
        birdType: form?.birdType ?? apiRow?.birdType ?? trip.birdType,
        totalBirds: loads.length > 0
          ? loads.reduce((sum, load) => sum + load.totalBirds, 0)
          : Number(form?.totalBirds ?? apiRow?.totalBirds ?? trip.totalBirds ?? 0),
        dcWeight: loads.length > 0
          ? round2(loads.reduce((sum, load) => sum + load.dcWeight, 0))
          : Number(form?.dcWeight ?? apiRow?.dcWeight ?? trip.dcWeight ?? 0),
        rate: safeParentRate,
        amount,
        paidAmount: Number(form?.amountPaid ?? apiRow?.paidAmount ?? 0),
        balance: Number(form?.balance ?? apiRow?.balance ?? 0),
        status: apiRow?.status ?? 'Pending',
        paymentDate: form?.paidDate ?? apiRow?.paymentDate ?? null,
        paymentMode: typeof (form?.paymentMode ?? apiRow?.paymentMode) === 'string'
          ? String(form?.paymentMode ?? apiRow?.paymentMode)
          : null,
        referenceNo: (form?.notes ? referenceFromNotes(form.notes) : apiRow?.referenceNo) ?? null,
        vehicleNo: trip.vehicleNo,
        isRentedVehicle: Boolean(paymentData[tripKey]?.isRentedVehicle ?? trip.isRentedVehicle),
        supervisorName: trip.supervisorName,
        loads,
      } as TripFarmPayment;
    });
  }, [allTrips, paymentData, apiLedger]);

  const allDisplayRows = useMemo<FarmPaymentDisplayRow[]>(
    () => flattenFarmPaymentsForTable(parentRows),
    [parentRows]
  );

  // ----- compute unique farms (per payable load) -----
  const farms = useMemo(() => {
    const farmSet = new Set<string>();
    allDisplayRows.forEach((row) => {
      if (row.farm) farmSet.add(row.farm);
    });
    return ['All', ...Array.from(farmSet)];
  }, [allDisplayRows]);

  // ----- filter display rows -----
  // Farm filtering is per load: a two-load trip with two farms shows only the
  // matching load row. Date and vehicle filters stay parent-trip based.
  // Search matches the canonical trip number, the displayed -L1/-L2 number,
  // farm, vehicle, driver, supervisor and bird type.
  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allDisplayRows.filter((row) => {
      const trip = tripById.get(String(row.tripId));
      if (!trip) return false;
      if (dateFrom && trip.tripDate < dateFrom) return false;
      if (dateTo && trip.tripDate > dateTo) return false;
      if (selectedFarm !== 'All' && row.farm !== selectedFarm) return false;

      if (query) {
        const match =
          row.displayTripNo.toLowerCase().includes(query) ||
          row.tripNo.toLowerCase().includes(query) ||
          row.farm.toLowerCase().includes(query) ||
          row.vehicleNo.toLowerCase().includes(query) ||
          String(trip.driverName ?? '').toLowerCase().includes(query) ||
          String(trip.supervisorName ?? '').toLowerCase().includes(query) ||
          row.birdType.toLowerCase().includes(query) ||
          [row.birds, row.dcWeight, row.rate, row.amount].some((value) =>
            [String(value), value.toLocaleString('en-IN'), Number(value).toFixed(2)].some((text) =>
              text.toLowerCase().includes(query),
            ),
          );
        if (!match) return false;
      }

      return true;
    });
  }, [allDisplayRows, tripById, dateFrom, dateTo, selectedFarm, searchQuery]);

  const hasInvalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);

  const exportRows = useMemo<FarmPaymentExportRow[]>(
    () => toFarmPaymentExportRows(filteredRows),
    [filteredRows]
  );

  // ----- compute KPI totals (based on filtered display rows) -----
  // One single-load trip counts once; a two-load trip counts both loads — the
  // same rows the table shows, summed exactly once.
  const totalBirdsKPI = useMemo(() => (
    filteredRows.reduce((sum, row) => sum + row.birds, 0)
  ), [filteredRows]);

  const totalWeightKPI = useMemo(() => (
    filteredRows.reduce((sum, row) => sum + row.dcWeight, 0)
  ), [filteredRows]);

  const totalAmountKPI = useMemo(() => (
    filteredRows.reduce((sum, row) => sum + row.amount, 0)
  ), [filteredRows]);

  // ----- pagination (global <Pagination /> handles clamping + windows) -----
  // Pagination counts payable display rows: a two-load trip occupies two slots.
  const paginatedRows = useMemo(
    () => filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredRows, currentPage, pageSize]
  );

  // ----- payment handlers -----
  // A rate edit touches exactly one display row: a single/legacy row writes
  // the parent rate, a multi-load row writes only its own load — the sibling
  // load's rate is never read, let alone overwritten. The parent totals are
  // recomputed from the loads so the table, totals and save payload agree.
  const handleDisplayRowUpdate = (row: FarmPaymentDisplayRow, rate: number) => {
    markDirty(row.key);
    const tripKey = String(row.tripId);
    setPaymentData((prev) => {
      const existing = prev[tripKey] || {};
      if (row.legId == null) {
        const dcWeight = Number(existing.dcWeight ?? row.dcWeight ?? 0);
        return {
          ...prev,
          [tripKey]: {
            ...existing,
            ratePerKg: rate,
            ratePerBird: 0,
            totalAmount: round2(dcWeight * rate),
            totalBirds: Number(existing.totalBirds ?? row.birds ?? 0),
            dcWeight,
            tripId: tripKey,
            updatedAt: new Date().toISOString(),
          },
        };
      }
      const apiLoads = apiFarmByTripRef.current.get(tripKey)?.loads ?? [];
      const baseLoads = existing.loads && existing.loads.length > 0 ? existing.loads : apiLoads;
      const seeded = baseLoads.length > 0
        ? baseLoads
        : [{
            legId: row.legId, load: row.load ?? 1, farmName: row.farm, birdType: row.birdType,
            totalBirds: row.birds, dcWeight: row.dcWeight, rate: row.rate, amount: row.amount,
          }];
      const loads = seeded.map((load) => {
        const same = (load.legId != null && load.legId === row.legId)
          || (load.legId == null && load.load === row.load);
        if (!same) return load;
        return { ...load, rate, amount: round2(row.dcWeight * rate) };
      });
      const weightSum = loads.reduce((sum, load) => sum + Number(load.dcWeight ?? 0), 0);
      const totalAmount = round2(loads.reduce((sum, load) => sum + Number(load.amount ?? 0), 0));
      const rates = loads.map((load) => Number(load.rate ?? 0));
      const parentRate = rates.length > 0 && rates.every((r) => r === rates[0])
        ? rates[0]
        : weightSum > 0 ? round2(totalAmount / weightSum) : (rates[0] ?? 0);
      return {
        ...prev,
        [tripKey]: {
          ...existing,
          loads,
          ratePerKg: parentRate,
          ratePerBird: 0,
          totalAmount,
          totalBirds: loads.reduce((sum, load) => sum + Number(load.totalBirds ?? 0), 0),
          dcWeight: round2(weightSum),
          tripId: tripKey,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  };

  const handleSaveAll = async () => {
    // Re-entrancy guard: the button is disabled while saving, but this makes
    // double-submission impossible even via keyboard/rapid re-entry.
    if (savingPayments) return;

    // Save ONLY the display rows edited in this session (see dirtyTripIds).
    // Each dirty row keeps its own identity (tripId + legId), so saving L1
    // can never overwrite L2. A row restored from a previous save keeps its
    // rate fields, so filtering on "has a rate" alone would re-save old
    // payments and inflate the count.
    const dirtyRows = allDisplayRows.filter((row) =>
      dirtyTripIds.has(row.key) && (row.rate > 0 || row.amount > 0)
    );

    if (dirtyRows.length === 0) {
      showNotification(t('accounts.farmpay.notif_no_changes'), 'info');
      return;
    }

    setSavingPayments(true);

    try {
      // Settlement fields live on the parent trip: attach them once per trip
      // (to the first dirty row of that trip), never once per load.
      const settledTrips = new Set<number>();
      const payload: TripFarmPaymentSaveInput[] = dirtyRows.map((row) => {
        const form = paymentData[String(row.tripId)] ?? {};
        const firstOfTrip = !settledTrips.has(row.tripId);
        if (firstOfTrip) settledTrips.add(row.tripId);
        const entry: TripFarmPaymentSaveInput = {
          tripId: row.tripId,
          rate: row.rate,
        };
        if (row.legId != null) {
          entry.legId = row.legId;
          if (row.load != null) entry.load = row.load;
        }
        if (firstOfTrip) {
          entry.paidAmount = form.amountPaid || 0;
          entry.paymentDate = form.paidDate || toBusinessDate(new Date());
          entry.paymentMode = form.paymentMode || 'Cash';
          entry.referenceNo = referenceFromNotes(form.notes) ?? null;
        }
        return entry;
      });

      const updated = await saveTripFarmPayments(payload);

      // Reload the ledger so the form mirrors the database (API is source of truth).
      const fresh = await loadTripFarmPayments().catch(() => updated);
      apiFarmByTripRef.current = new Map(fresh.map((row) => [String(row.tripId), row]));
      setApiLedger(fresh);
      syncPaymentData(allTrips);
      clearDirty();

      const savedCount = dirtyRows.length || updated.length || payload.length;
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
    // Instant local sync from the API ledger — no reload.
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
    // Clear means "every trip ever" — no dates, no farm, no search.
    setDateFrom(defaultRange.from);
    setDateTo(defaultRange.to);
    setSelectedFarm('All');
    setSearchQuery('');
    setCurrentPage(1);
    showNotification(t('accounts.farmpay.notif_filters_cleared'), 'info');
  };

  const exportScope = { from: dateFrom, to: dateTo, farm: selectedFarm, search: searchQuery.trim() };
  const handleExportPdf = async () => {
    if (exportingPdf || exportRows.length === 0) return;
    setExportingPdf(true);
    try {
      const { exportFarmPaymentsPdf } = await import('../utils/farmPaymentExport');
      await exportFarmPaymentsPdf(exportRows, exportScope);
      showNotification(`PDF exported for ${exportRows.length} filtered payable row(s).`, 'success');
    } catch (error) {
      console.error('Farm payment PDF export failed:', error);
      showNotification('Unable to export Farm Payment PDF.', 'error');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    if (exportingExcel || exportRows.length === 0) return;
    setExportingExcel(true);
    try {
      // Yield once so the animated busy state paints before XLSX work starts.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 40));
      const { exportFarmPaymentsExcel } = await import('../utils/farmPaymentExport');
      exportFarmPaymentsExcel(exportRows, exportScope);
      showNotification(`Excel exported for ${exportRows.length} filtered payable row(s).`, 'success');
    } catch (error) {
      console.error('Farm payment Excel export failed:', error);
      showNotification('Unable to export Farm Payment Excel.', 'error');
    } finally {
      setExportingExcel(false);
    }
  };

  // Unsaved rows = display rows edited since the last load/save (same set
  // Save Payments persists), so the Save/Reset buttons enable exactly when
  // there is something new to save — never for rows restored from a save.
  const modifiedCount = useMemo(() => (
    allDisplayRows.filter((row) => dirtyTripIds.has(row.key) && (row.rate > 0 || row.amount > 0)).length
  ), [allDisplayRows, dirtyTripIds]);

  // The page opens unfiltered, so "filtered" means: a date, farm, or search
  // the user picked. Only then does the totals bar appear under the table.
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
              {loading ? t('accounts.farmpay.updating') : filteredRows.length}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto lg:justify-end">
            <button
              type="button"
              onClick={() => void handleExportPdf()}
              disabled={loading || exportingPdf || exportRows.length === 0}
              className="group inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 transition-all hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exportingPdf ? <LoaderCircle size={14} className="animate-spin" /> : <FileText size={14} className="motion-safe:group-hover:animate-pulse" />}
              {exportingPdf ? 'Creating PDF…' : 'PDF'}
            </button>
            <button
              type="button"
              onClick={() => void handleExportExcel()}
              disabled={loading || exportingExcel || exportRows.length === 0}
              className="group inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-all hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exportingExcel ? <LoaderCircle size={14} className="animate-spin" /> : <FileSpreadsheet size={14} className="motion-safe:group-hover:animate-pulse" />}
              {exportingExcel ? 'Creating Excel…' : 'Excel'}
            </button>
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
              rows={paginatedRows}
              onRateChange={handleDisplayRowUpdate}
              loading={loading && allTrips.length === 0}
              onViewTrip={handleViewTrip}
              startIndex={(currentPage - 1) * pageSize}
              emptyMessage={
                hasInvalidDateRange
                  ? t('accounts.payment.invalid_range')
                  : isFilterActive
                  ? t('accounts.farmpay.empty_no_filters')
                  : t('accounts.farmpay.empty_no_data')
              }
            />

            {/* Totals bar — the last strip of the table, only once a date range
                or filter narrows the list. */}
            {isFilterActive && filteredRows.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-slate-200/70 bg-slate-50/80 px-4 py-2">
                <p className="text-[11px] font-semibold text-slate-500">
                  {t('accounts.farmpay.totals_for_rows', { count: filteredRows.length })}
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
            {shouldShowPagination(filteredRows.length) && (
              <Pagination
                page={currentPage}
                pageSize={pageSize}
                totalItems={filteredRows.length}
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
        initialLoad={viewingLoad}
        onClose={() => { viewRequestSeqRef.current += 1; setViewingTrip(null); setViewingLoad(null); }}
      />
    </div>
  );

  return content;
}
