import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Lock, Plus, RotateCcw, Search, Store, X } from "lucide-react";
import type { ShopSale } from "../types/shopSale";
import type { Shop } from "../../../masters/shops/types/shop";
import AppShellModal from "../../../../ui/AppShellModal";
import { formatTripListDay } from "../../vehicle-trips/utils/formatTripListDay";
import { formatShopWithSubShop } from "../../vehicle-trips/utils/shopDisplayName";
import { dcAccountedWeight, isValidTripSaleRow } from "../utils/tripSaleValidation";

type DropdownOption = { value: string; label: string };

type NumericField = "birds" | "weight" | "mortality" | "mortalityWeight" | "rate";

function EditableNumberCell({ value, integer, ariaLabel, onCommit, readOnly = false }: {
  value: number; integer: boolean; ariaLabel: string; onCommit: (value: number) => void; readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!editing || !inputRef.current) return;
    inputRef.current.focus({ preventScroll: true });
    inputRef.current.select();
  }, [editing]);
  const commit = () => {
    const normalized = draft.trim();
    const parsed = Number(normalized);
    if (!normalized || !Number.isFinite(parsed) || parsed < 0 || (integer && !Number.isInteger(parsed))) {
      setDraft(String(value));
      setEditing(false);
      return;
    }
    onCommit(parsed);
    setEditing(false);
  };
  if (readOnly) return <span aria-label={`${ariaLabel}. Read only`} className="mx-auto flex h-9 w-full max-w-[104px] items-center justify-center px-2 text-center text-xs font-semibold tabular-nums text-slate-700">{value}</span>;
  if (!editing) return <button type="button" aria-label={`${ariaLabel}. Press Enter to edit`} onClick={() => { setDraft(String(value)); setEditing(true); }} className="mx-auto flex h-9 w-full max-w-[104px] items-center justify-center rounded-md border border-transparent px-2 text-center text-xs font-semibold tabular-nums text-slate-800 outline-none transition-colors hover:border-slate-200 hover:bg-white/80 focus-visible:border-emerald-300 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-emerald-100">{value}</button>;
  return <input ref={inputRef} type="text" inputMode={integer ? "numeric" : "decimal"} autoComplete="off" aria-label={ariaLabel} value={draft}
    onChange={(event) => { const next = event.target.value; if ((integer ? /^\d*$/ : /^\d*(?:\.\d*)?$/).test(next)) setDraft(next); }}
    onBlur={commit} onWheel={(event) => event.currentTarget.blur()}
    onKeyDown={(event) => {
      if (event.key === "Enter") { event.preventDefault(); commit(); }
      else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setDraft(String(value)); setEditing(false); }
    }}
    className="mx-auto h-9 w-full max-w-[104px] rounded-lg border border-emerald-300 bg-white px-2 text-center text-xs font-semibold tabular-nums text-slate-900 outline-none ring-2 ring-emerald-100" />;
}

function EditableTextCell({ value, ariaLabel, onCommit, readOnly = false }: { value: string; ariaLabel: string; onCommit: (value: string) => void; readOnly?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (editing) { inputRef.current?.focus({ preventScroll: true }); inputRef.current?.select(); } }, [editing]);
  const commit = () => { onCommit(draft); setEditing(false); };
  if (readOnly) return <span aria-label={`${ariaLabel}. Read only`} className="block h-9 w-full min-w-24 truncate px-2 text-center text-[11px] leading-9 text-slate-600">{value || <span className="text-slate-300">—</span>}</span>;
  if (!editing) return <button type="button" aria-label={`${ariaLabel}. Press Enter to edit`} onClick={() => { setDraft(value); setEditing(true); }} className="h-9 w-full min-w-24 truncate rounded-md border border-transparent px-2 text-center text-[11px] text-slate-600 outline-none transition-colors hover:border-slate-200 hover:bg-white/80 focus-visible:border-emerald-300 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-emerald-100">{value || <span className="text-slate-300">—</span>}</button>;
  return <input ref={inputRef} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => {
    if (event.key === "Enter") { event.preventDefault(); commit(); }
    else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setDraft(value); setEditing(false); }
  }} aria-label={ariaLabel} className="h-9 w-full min-w-24 rounded-lg border border-emerald-300 bg-white px-2 text-center text-[11px] outline-none ring-2 ring-emerald-100" />;
}
function PopupDropdown({ value, options, onChange, placeholder, searchable = false, ariaLabel, centered = false, readOnly = false }: {
  value: string; options: DropdownOption[]; onChange: (value: string) => void; placeholder: string;
  searchable?: boolean; ariaLabel: string; centered?: boolean; readOnly?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);
  const selected = options.find((option) => option.value === value);
  const filtered = options.filter((option) => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const label = option.label.trim().toLocaleLowerCase();
    return !normalizedQuery || (searchable ? label.startsWith(normalizedQuery) : label.includes(normalizedQuery));
  });

  useEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const trigger = buttonRef.current;
      const dialog = trigger?.closest<HTMLElement>('[role="dialog"]');
      if (!trigger || !dialog) return;
      const triggerRect = trigger.getBoundingClientRect();
      const bounds = dialog.getBoundingClientRect();
      const gap = 8;
      const left = Math.max(bounds.left + gap, Math.min(triggerRect.left, bounds.right - triggerRect.width - gap));
      const width = Math.min(triggerRect.width, bounds.width - gap * 2);
      const desiredHeight = searchable ? 232 : 188; // five 36px options plus the compact search row
      const below = Math.max(0, bounds.bottom - triggerRect.bottom - gap * 2);
      const above = Math.max(0, triggerRect.top - bounds.top - gap * 2);
      const placeBelow = below >= Math.min(desiredHeight, 112) || below >= above;
      const maxHeight = Math.max(84, Math.min(desiredHeight, placeBelow ? below : above));
      const top = placeBelow
        ? Math.min(triggerRect.bottom + 4, bounds.bottom - maxHeight - gap)
        : Math.max(bounds.top + gap, triggerRect.top - maxHeight - 4);
      setPosition({ top, left, width, maxHeight });
    };
    updatePosition();
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) && !menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    const focusId = window.requestAnimationFrame(() => {
      if (searchable) searchRef.current?.focus();
      else optionRefs.current[Math.min(activeIndex, Math.max(0, filtered.length - 1))]?.focus();
    });
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
      window.cancelAnimationFrame(focusId);
    };
  // Focus once when the menu opens; arrow navigation is handled by the menu
  // key handler itself and should not repeatedly steal focus back to search.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, searchable]);

  const choose = (next: string) => { onChange(next); setOpen(false); setQuery(""); window.requestAnimationFrame(() => buttonRef.current?.focus()); };
  const moveActive = (direction: 1 | -1) => {
    if (!filtered.length) return;
    setActiveIndex((current) => {
      const next = (current + direction + filtered.length) % filtered.length;
      window.requestAnimationFrame(() => optionRefs.current[next]?.focus());
      return next;
    });
  };
  const handleMenuKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Tab") {
      setOpen(false);
      setQuery("");
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      if (!open) {
        const selectedIndex = options.findIndex((option) => option.value === value);
        setActiveIndex(Math.max(0, selectedIndex));
        setOpen(true);
      }
      else moveActive(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Enter" && open && filtered[activeIndex]) {
      event.preventDefault();
      choose(filtered[activeIndex].value);
      return;
    }
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      setQuery("");
      window.requestAnimationFrame(() => buttonRef.current?.focus());
    }
  };
  return <div className="min-w-0" ref={rootRef}>
    <button ref={buttonRef} type="button" disabled={readOnly} aria-label={readOnly ? `${ariaLabel}. Read only` : ariaLabel} aria-haspopup="listbox" aria-expanded={open} onClick={() => { if (open) { setOpen(false); return; } setQuery(""); const selectedIndex = options.findIndex((option) => option.value === value); setActiveIndex(Math.max(0, selectedIndex)); setOpen(true); }} onKeyDown={handleMenuKeyDown} className={`flex h-9 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border px-2.5 text-[12px] font-semibold text-slate-700 outline-none transition-colors hover:border-slate-200 hover:bg-white/80 focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100 disabled:cursor-default disabled:hover:border-transparent disabled:hover:bg-transparent ${centered ? "text-center" : "text-left"} ${open ? "border-emerald-300 bg-white ring-2 ring-emerald-100" : "border-transparent bg-transparent"}`}>
      <span className={`truncate ${centered ? "text-center" : "text-left"} ${selected ? "text-slate-800" : "text-slate-400"}`}>{selected?.label ?? placeholder}</span><ChevronDown size={14} className={`shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}/>
    </button>
    {open && position && typeof document !== "undefined" ? createPortal(<div ref={menuRef} role="listbox" aria-label={ariaLabel} className="fixed z-[120] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15 animate-scale-in" style={{ top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight }}>
      {searchable && <div className="border-b border-slate-100 bg-slate-50/70 p-1.5"><div className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5"><Search size={12} className="shrink-0 text-slate-400"/><input ref={searchRef} value={query} onChange={(event)=>{setQuery(event.target.value);setActiveIndex(0);}} onKeyDown={handleMenuKeyDown} placeholder="Search shop name…" className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400"/></div></div>}
      <div className="overflow-y-auto p-1" style={{ maxHeight: position.maxHeight - (searchable ? 52 : 8) }}>{filtered.length ? filtered.map((option,index)=><button ref={(element)=>{optionRefs.current[index]=element;}} key={option.value} type="button" role="option" tabIndex={index===activeIndex?0:-1} aria-selected={option.value===value} onFocus={()=>setActiveIndex(index)} onKeyDown={handleMenuKeyDown} onClick={()=>choose(option.value)} className={`flex min-h-9 w-full items-center justify-between rounded-lg px-2.5 text-xs transition-colors ${centered ? "text-center" : "text-left"} ${index===activeIndex?"bg-emerald-50":"hover:bg-emerald-50"} ${option.value===value?"font-bold text-emerald-800":"font-medium text-slate-700"}`}><span className={`truncate ${centered?"text-center":"text-left"}`}>{option.label}</span>{option.value===value?<Check size={13} className="shrink-0 text-emerald-600"/>:null}</button>):<p className="px-2.5 py-3 text-xs text-slate-400">No matching shops</p>}</div>
    </div>, document.body) : null}
  </div>;
}

export type LoadSaleDraft = {
  id?: number;
  load: number;
  shopId: number;
  birds: number;
  weight: number;
  mortality: number;
  mortalityWeight: number;
  deliveryMode: "box" | "weight";
  rate: number;
  remarks: string;
};

type Props = {
  sale: ShopSale | null;
  shops: Shop[];
  deliveries: ShopSale[];
  saving: boolean;
  readOnly?: boolean;
  lockMessage?: string;
  onClose: () => void;
  onSaveLoad: (tripId: number, rows: LoadSaleDraft[]) => Promise<void>;
};

export default function ShopSaleEditModal({ sale, shops, deliveries, saving, readOnly = false, lockMessage, onClose, onSaveLoad }: Props) {
  const [rows, setRows] = useState<LoadSaleDraft[]>(() => deliveries.map((row) => ({ id: row.numericId, load: row.load ?? 1, shopId: row.numericShopId ?? 0, birds: row.totalBirds, weight: row.totalWeight, mortality: row.mortality ?? 0, mortalityWeight: row.mortalityWeight ?? 0, deliveryMode: row.deliveryMode ?? "box", rate: row.rate ?? 0, remarks: row.remark ?? "" })));
  const [activeRowId, setActiveRowId] = useState<number | null>(sale?.numericId ?? null);
  const initialRowsRef = useRef<LoadSaleDraft[]>(rows);
  const [search, setSearch] = useState("");
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const selectedRowRefs = useRef(new Map<number, HTMLTableRowElement>());
  const focusedSaleIdRef = useRef<number | null>(null);
  const selectedDeliveryId = sale?.numericId;
  useEffect(() => {
    if (rows.length === 0 || selectedDeliveryId == null || focusedSaleIdRef.current === selectedDeliveryId) return;
    const saleId = selectedDeliveryId;
    const frame = window.requestAnimationFrame(() => {
      const selectedRow = selectedRowRefs.current.get(saleId);
      const scroller = tableScrollRef.current;
      if (!selectedRow || !scroller) return;
      const rowTop = scroller.scrollTop + selectedRow.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      scroller.scrollTo({ top: Math.max(0, rowTop - (scroller.clientHeight - selectedRow.clientHeight) / 2), behavior: "smooth" });
      focusedSaleIdRef.current = saleId;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedDeliveryId, rows.length, search]);
  if (!sale) return null;
  const loadNumbers = [...new Set([...deliveries.map((row) => Number(row.load ?? 1)), ...rows.map((row) => row.load)])].sort((a, b) => a - b);
  const reconciliation = loadNumbers.map((load) => {
    const capacityRows = deliveries.filter((row) => Number(row.load ?? 1) === load);
    const loadDcBirds = Number(capacityRows[0]?.dcBirds ?? 0);
    const loadDcWeight = Number(capacityRows[0]?.dcWeight ?? 0);
    const recordedWeightLoss = Number(capacityRows[0]?.loadWeightLoss ?? 0);
    const totals = rows.filter((row) => row.load === load).reduce((sum, row) => ({ birds: sum.birds + row.birds, mortality: sum.mortality + row.mortality, weight: sum.weight + row.weight, mortalityWeight: sum.mortalityWeight + row.mortalityWeight }), { birds: 0, mortality: 0, weight: 0, mortalityWeight: 0 });
    const modeMortality = rows.filter((row) => row.load === load).reduce((sum, row) => ({
      boxBirds: sum.boxBirds + (row.deliveryMode === "box" ? row.mortality : 0),
      boxWeight: sum.boxWeight + (row.deliveryMode === "box" ? row.mortalityWeight : 0),
      weightBirds: sum.weightBirds + (row.deliveryMode === "weight" ? row.mortality : 0),
      weightKg: sum.weightKg + (row.deliveryMode === "weight" ? row.mortalityWeight : 0),
    }), { boxBirds: 0, boxWeight: 0, weightBirds: 0, weightKg: 0 });
    const accountedWeight = rows.filter((row) => row.load === load).reduce((sum, row) => sum + dcAccountedWeight(row), 0);
    return { load, dcBirds: loadDcBirds, dcWeight: loadDcWeight, ...totals, ...modeMortality, weightLoss: recordedWeightLoss, birdGap: loadDcBirds - totals.birds - totals.mortality, pendingWeight: loadDcWeight - accountedWeight - recordedWeightLoss };
  });
  const remainingBirds = reconciliation.reduce((sum, load) => sum + load.birdGap, 0);
  const weightLoss = reconciliation.reduce((sum, load) => sum + load.weightLoss, 0);
  const totals = rows.reduce((sum, row) => ({ birds: sum.birds + row.birds, mortality: sum.mortality + row.mortality, weight: sum.weight + row.weight, mortalityWeight: sum.mortalityWeight + row.mortalityWeight }), { birds: 0, mortality: 0, weight: 0, mortalityWeight: 0 });
  const totalAmount = rows.reduce((sum, row) => sum + row.weight * row.rate, 0);
  const hasUnallocatedCapacity = reconciliation.some((load) => load.birdGap > 0 || load.pendingWeight > 0.0005);
  const loadsNeedingShop = reconciliation.filter((load) => load.birdGap > 0 || load.pendingWeight > 0.0005);
  const pendingLoads = reconciliation.filter((load) => load.birdGap > 0 || load.pendingWeight > 0.0005);
  const pendingAssignmentMessage = pendingLoads.map((load) => {
    const balances = [
      load.birdGap > 0 ? `Pending birds ${load.birdGap.toLocaleString()}` : "",
      load.pendingWeight > 0.0005 ? `Pending weight ${load.pendingWeight.toFixed(2)} kg` : "",
    ].filter(Boolean);
    return `Load ${load.load} · ${balances.join(" · ")}`;
  }).join("  |  ");
  const selectedAddLoad = loadsNeedingShop[0]?.load;
  const invalidQuantityRow = rows.find((row) => !isValidTripSaleRow(row));
  const removalRows = rows.filter((row) => row.id != null && row.birds === 0 && row.weight === 0 && row.mortality === 0 && row.mortalityWeight === 0);
  const valid = rows.length > 0 && !invalidQuantityRow && reconciliation.every((load) => load.birdGap === 0 && Math.abs(load.pendingWeight) <= 0.0005);
  const validationMessage = valid
    ? removalRows.length > 0
      ? `${removalRows.length} zero-delivery shop ${removalRows.length === 1 ? "will be" : "rows will be"} removed on save. All loads reconcile.`
      : "All loads reconcile with DC totals."
    : pendingAssignmentMessage
      || (invalidQuantityRow
        ? invalidQuantityRow.birds > 0 && invalidQuantityRow.weight <= 0
          ? "Every delivered-bird row must have a weight greater than 0 kg."
          : invalidQuantityRow.deliveryMode === "box" && invalidQuantityRow.mortality > 0 && invalidQuantityRow.mortalityWeight <= 0
            ? "Box-mode mortality birds must include mortality weight."
            : "Complete every shop row with matching birds and weight, and enter a valid rate."
        : remainingBirds !== 0
          ? `Birds must match DC exactly. Difference: ${remainingBirds}.`
          : reconciliation.some((load) => load.pendingWeight < -0.0005)
            ? "Delivered weight plus Box mortality weight exceeds DC weight."
            : "Complete every shop row and enter valid rates before saving.");
  const filtered = rows.map((row, index) => ({ row, index, shop: shops.find((shop) => shop.id === row.shopId) })).filter(({ row, shop }) => !search.trim() || (shop?.shopName ?? "").toLowerCase().includes(search.trim().toLowerCase()) || String(row.id ?? "").includes(search.trim()));
  const shopOptions = shops.filter((shop) => shop.status === "Active" || rows.some((row) => row.shopId === shop.id)).map((shop) => ({ value: String(shop.id), label: shop.shopName }));
  const loadOptions = loadNumbers.map((load) => ({ value: String(load), label: `Load ${load}` }));
  const modeOptions = [{ value: "box", label: "Box" }, { value: "weight", label: "Weight" }];
  const change = (index: number, field: keyof LoadSaleDraft, value: string) => setRows((current) => current.map((row, at) => at === index ? { ...row, [field]: field === "shopId" || field === "birds" || field === "mortality" || field === "load" ? Number(value) : field === "deliveryMode" ? value : field === "remarks" ? value : Number(value) } as LoadSaleDraft : row));
  const addShop = (load: number) => setRows((current) => [...current, { load, shopId: 0, birds: 0, weight: 0, mortality: 0, mortalityWeight: 0, deliveryMode: "box", rate: Number(sale.rate ?? 50), remarks: "" }]);
  const resetRows = () => setRows(initialRowsRef.current.map((row) => ({ ...row })));
  const save = async () => { if (readOnly || !valid || saving || sale.numericTripId == null) return; await onSaveLoad(sale.numericTripId, rows); };
  return <AppShellModal open onClose={onClose} closeOnOverlay={!saving} ariaLabelledBy="shop-sale-edit-title" panelClassName="max-w-[96rem] bg-white">
    <section className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white text-slate-800">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2"><span className="group inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm"><Store size={16} className="transition-transform duration-200 group-hover:scale-110"/></span><h2 id="shop-sale-edit-title" className="shrink-0 text-[15px] font-bold tracking-tight text-slate-900">{readOnly ? "Shop Sale details" : "Shop Sales"}</h2><span className="text-sm font-black text-slate-300">•</span><span className="max-w-[245px] truncate rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-extrabold tabular-nums text-emerald-800" title={sale.saleNo || `Trip ${sale.tripNo}`}>{sale.saleNo || `Trip ${sale.tripNo}`}</span><span className="text-sm font-black text-slate-300">•</span><span className="hidden max-w-[180px] truncate text-[11px] font-bold text-slate-600 lg:inline">{formatTripListDay(sale.tripDate)}</span><span className="hidden max-w-[280px] truncate text-[11px] font-semibold text-slate-500 xl:inline" title={formatShopWithSubShop(sale.shopName, sale.subShopName) || sale.shopName}>Selected: {formatShopWithSubShop(sale.shopName, sale.subShopName) || sale.shopName}</span><label className="relative ml-1 hidden w-full max-w-[280px] flex-1 sm:block"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search shops…" className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/80 pl-8 pr-3 text-[12px] font-medium text-slate-700 outline-none transition-all hover:border-slate-300 hover:bg-white focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"/></label>{!readOnly && <button type="button" onClick={resetRows} disabled={saving} title="Reset all shop changes" aria-label="Reset all shop changes" className="group inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800 disabled:cursor-not-allowed disabled:opacity-50"><RotateCcw size={14} className="transition-transform duration-300 group-hover:-rotate-90"/>Reset</button>}{!readOnly && hasUnallocatedCapacity && <button type="button" onClick={()=>selectedAddLoad != null && addShop(selectedAddLoad)} title="Add a shop to allocate the remaining DC balance" className="group inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 text-xs font-bold text-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100"><Plus size={14} className="transition-transform duration-200 group-hover:rotate-90"/>Add shop</button>}</div>
        <div className="flex shrink-0 items-center gap-2"><span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-bold tabular-nums text-emerald-800 sm:inline-flex">{deliveries.length} shops · {loadNumbers.length} loads</span><button type="button" onClick={onClose} disabled={saving} className="group x-anim inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-100 hover:bg-red-50 hover:text-red-500 active:scale-95" aria-label="Close"><span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-close)]"><X size={16}/></span></button></div>
      </header>
      {readOnly && <div role="status" className="flex shrink-0 items-center gap-2 border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-xs font-semibold text-amber-900"><Lock size={15} className="shrink-0"/><span>14-day Shop Sales editing period is complete. This trip is view-only.</span>{lockMessage ? <span className="hidden text-amber-700 md:inline">{lockMessage}</span> : null}</div>}
      <section className="grid shrink-0 grid-cols-1 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5" aria-label="Trip KPIs">
        <article className="flex min-h-[112px] flex-col overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-orange-50 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md xl:min-h-[132px]">
          <div className="flex items-center justify-between gap-2 border-b border-amber-100 px-3.5 py-2"><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-wider text-amber-700/70">Trip total</p><p className="truncate text-[10px] font-semibold text-slate-500">{deliveries.length} shops <b className="text-amber-300">•</b> {totals.birds.toLocaleString()} birds <b className="text-amber-300">•</b> {totals.weight.toFixed(2)} kg</p></div><div className="text-right"><p className="text-[8px] font-bold uppercase tracking-wider text-amber-700/70">Amount</p><p className="text-base font-extrabold leading-none text-amber-900 tabular-nums">₹{totalAmount.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}</p></div></div>
          <div className={`grid flex-1 gap-2 p-2 ${reconciliation.length === 2 ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`} aria-label="Totals by load">
            {reconciliation.map((load)=><div key={`kpi-load-${load.load}`} className={`flex min-h-[92px] flex-col justify-center rounded-xl border px-3 py-2.5 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${load.birdGap === 0 && Math.abs(load.pendingWeight) <= 0.0005 ? "border-amber-200/70 bg-white/90" : "border-orange-200 bg-orange-50/70"}`}>
              <div className="flex items-center justify-between gap-1"><span className="rounded-lg bg-amber-100 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-amber-800">Load {load.load}</span><span className="text-[11px] font-extrabold text-amber-900 tabular-nums">{rows.filter(row=>row.load===load.load).length} shops</span></div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-600 tabular-nums"><span>{load.birds.toLocaleString()} birds</span><span>{load.weight.toFixed(2)} kg</span><span className="text-rose-700">{load.mortality} MOR BIRDS · {load.mortalityWeight.toFixed(2)} MOR KG</span><span className="text-blue-700">DC {load.dcBirds} · {load.dcWeight.toFixed(2)} kg</span>{load.weightLoss>0.0005?<span className="font-extrabold text-violet-700">WT LOSS {load.weightLoss.toFixed(2)} kg</span>:null}</div>
              {load.birdGap>0||load.pendingWeight>0.0005?<div className="mt-2 flex flex-wrap gap-1.5" aria-label={`Pending allocation for Load ${load.load}`}>{load.birdGap>0?<span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-1 text-[10px] font-extrabold text-sky-800 tabular-nums">Pending birds {load.birdGap.toLocaleString()}</span>:null}{load.pendingWeight>0.0005?<span className="rounded-md border border-orange-200 bg-orange-50 px-2 py-1 text-[10px] font-extrabold text-orange-800 tabular-nums">Pending weight {load.pendingWeight.toFixed(2)} kg</span>:null}</div>:null}
            </div>)}
          </div>
        </article>
      </section>
      <div ref={tableScrollRef} className="min-h-0 flex-1 overflow-auto bg-white scroll-smooth">
        <table className="w-full min-w-[1500px] table-fixed text-[13px]">
          <colgroup><col className="w-[5%]"/><col className="w-[23%]"/><col className="w-[8%]"/><col className="w-[8%]"/><col className="w-[8%]"/><col className="w-[9%]"/><col className="w-[9%]"/><col className="w-[9%]"/><col className="w-[9%]"/><col className="w-[10%]"/><col className="w-[12%]"/></colgroup>
          <thead className="sticky top-0 z-10 bg-slate-50"><tr className="border-b border-slate-200">{["S.No","Shop name","Load","Mode","Birds","Weight kg","MOR BIRDS","MOR KG","Rate (₹/kg)","Amount (₹)","Remarks"].map((label)=><th key={label} className={`border-b border-slate-200 px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider text-slate-600 ${label==="Birds"?"bg-sky-50/80":label==="Weight kg"?"bg-orange-50/80":label==="MOR BIRDS"||label==="MOR KG"?"bg-rose-50/75":""}`}>{label}</th>)}</tr></thead>
          <tbody>{filtered.map(({row,index})=>{const shop=shops.find((item)=>item.id===row.shopId);const selected=row.id!=null&&row.id===activeRowId;return <tr key={row.id??`new-${index}`} onClick={()=>row.id!=null&&setActiveRowId(row.id)} onFocus={()=>row.id!=null&&setActiveRowId(row.id)} ref={(element)=>{if(row.id!=null){if(element)selectedRowRefs.current.set(row.id,element);else selectedRowRefs.current.delete(row.id);}}} data-selected-delivery={selected?"true":undefined} className={`relative border-b border-slate-100 transition-colors duration-150 hover:bg-emerald-50/25 ${selected?"bg-emerald-50/45 shadow-[inset_3px_0_0_0_#6ee7b7]":""} ${!row.id?"motion-safe:animate-[var(--animate-fade-in-up)]":""}`} style={!row.id?{animationDelay:`${Math.min(index,8)*24}ms`}:undefined}>
            <td className="border-r border-slate-100 px-2 py-4 text-center text-[13px] font-bold tabular-nums text-slate-700">{index+1}</td>
            <td className="px-3 py-3"><div className="min-w-0"><PopupDropdown readOnly={readOnly} ariaLabel={`Shop for row ${index+1}`} value={row.shopId?String(row.shopId):""} options={shopOptions} placeholder="Select shop" searchable centered onChange={(value)=>change(index,"shopId",value)}/></div>{row.id && row.remarks?.trim()?<div className="mt-1 truncate text-center text-[11px] font-medium text-indigo-600">{row.remarks}</div>:null}</td>
            <td className="px-2 py-3 text-center"><div className="mx-auto w-24"><PopupDropdown readOnly={readOnly} ariaLabel={`Load for row ${index+1}`} value={String(row.load)} options={loadOptions} placeholder="Load" centered onChange={(value)=>change(index,"load",value)}/></div></td>
            <td className="px-2 py-3 text-center"><div className="mx-auto w-24"><PopupDropdown readOnly={readOnly} ariaLabel={`Delivery mode for row ${index+1}`} value={row.deliveryMode} options={modeOptions} placeholder="Mode" centered onChange={(value)=>change(index,"deliveryMode",value)}/></div></td>
            {(["birds","weight","mortality","mortalityWeight","rate"] as NumericField[]).map((field)=><td key={field} className={`px-2 py-3 text-center ${field==="birds"?"bg-sky-50/25":field==="weight"?"bg-orange-50/25":field==="mortality"||field==="mortalityWeight"?"bg-rose-50/20":""}`}><EditableNumberCell readOnly={readOnly} value={row[field]} integer={field==="birds"||field==="mortality"} ariaLabel={`${field} for ${shop?.shopName??`row ${index+1}`}`} onCommit={(next)=>change(index,field,String(next))}/></td>)}
            <td className="px-3 py-3 text-center text-[13px] font-medium tabular-nums text-slate-700">₹{(row.weight*row.rate).toLocaleString("en-IN",{minimumFractionDigits:2})}</td>
            <td className="px-2 py-3"><EditableTextCell readOnly={readOnly} value={row.remarks} onCommit={(next)=>change(index,"remarks",next)} ariaLabel={`Remarks for ${shop?.shopName??"new shop"}`}/></td>
          </tr>;})}</tbody>
        </table>
        <section className="mt-5 border-t border-indigo-100 bg-white px-4 py-3" aria-label="Trip details summary">
        <div className="mb-2 flex items-center justify-between"><div><h3 className="text-[11px] font-bold uppercase tracking-wider text-indigo-800">Trip Details — DC &amp; Shop Reconciliation</h3><p className="mt-0.5 text-[10px] text-slate-500">Final trip summary · grouped by load</p></div></div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[1180px] table-fixed text-[10px]">
            <thead className="sticky top-0 z-10 bg-slate-50 text-slate-600"><tr className="border-b border-slate-200 uppercase tracking-wide">{[["Load","8%"],["Shops","8%"],["DC wt (kg)","10%"],["Del wt (kg)","10%"],["DC birds","10%"],["Del birds","10%"],["Box mor birds","11%"],["Box mor wt (kg)","11%"],["Wt mor birds","10%"],["Wt loss (kg)","12%"]].map(([label,width])=><th key={label} style={{width}} className="px-2 py-2 text-center">{label}</th>)}</tr></thead>
            <tbody>{reconciliation.map((load)=>{const invalid=load.birdGap!==0||Math.abs(load.pendingWeight)>0.0005;return <tr key={`dc-summary-${load.load}`} className={`border-b border-slate-100 transition-colors ${invalid?"bg-rose-50/70":"even:bg-slate-50/50"}`}><td className="px-2 py-2 text-center font-bold text-indigo-700">Load {load.load}</td><td className="px-2 py-2 text-center tabular-nums">{rows.filter((row)=>row.load===load.load).length}</td><td className="bg-orange-50/60 px-2 py-2 text-center font-bold tabular-nums text-orange-800">{load.dcWeight.toFixed(2)}</td><td className="bg-orange-50/40 px-2 py-2 text-center tabular-nums text-orange-700">{load.weight.toFixed(2)}</td><td className="bg-sky-50/65 px-2 py-2 text-center font-bold tabular-nums text-sky-800">{load.dcBirds.toLocaleString()}</td><td className="bg-sky-50/45 px-2 py-2 text-center tabular-nums text-sky-700">{load.birds.toLocaleString()}</td><td className="bg-rose-50/60 px-2 py-2 text-center tabular-nums text-rose-800">{load.boxBirds.toLocaleString()}</td><td className="bg-rose-50/45 px-2 py-2 text-center tabular-nums text-rose-700">{load.boxWeight.toFixed(2)}</td><td className="bg-rose-50/30 px-2 py-2 text-center tabular-nums text-rose-700">{load.weightBirds.toLocaleString()}{load.weightKg>0?<span className="block text-[9px] text-slate-500">{load.weightKg.toFixed(2)} kg</span>:null}</td><td className={`px-2 py-2 text-center font-bold tabular-nums ${invalid?"text-rose-700":"text-amber-700"}`}>{Math.max(0,load.weightLoss).toFixed(2)}</td></tr>;})}</tbody>
            <tfoot className="border-t-2 border-indigo-200 bg-indigo-50 font-bold text-slate-800"><tr><td className="px-2 py-2 text-center">Total</td><td className="px-2 py-2 text-center tabular-nums">{rows.length}</td><td className="px-2 py-2 text-center tabular-nums text-orange-800">{reconciliation.reduce((sum,load)=>sum+load.dcWeight,0).toFixed(2)}</td><td className="px-2 py-2 text-center tabular-nums text-orange-700">{totals.weight.toFixed(2)}</td><td className="px-2 py-2 text-center tabular-nums text-sky-800">{reconciliation.reduce((sum,load)=>sum+load.dcBirds,0).toLocaleString()}</td><td className="px-2 py-2 text-center tabular-nums text-sky-700">{totals.birds.toLocaleString()}</td><td className="px-2 py-2 text-center tabular-nums text-rose-800">{reconciliation.reduce((sum,load)=>sum+load.boxBirds,0).toLocaleString()}</td><td className="px-2 py-2 text-center tabular-nums text-rose-700">{reconciliation.reduce((sum,load)=>sum+load.boxWeight,0).toFixed(2)}</td><td className="px-2 py-2 text-center tabular-nums text-rose-700">{reconciliation.reduce((sum,load)=>sum+load.weightBirds,0).toLocaleString()}{reconciliation.some((load)=>load.weightKg>0)?<span className="block text-[9px] font-normal text-slate-500">{reconciliation.reduce((sum,load)=>sum+load.weightKg,0).toFixed(2)} kg</span>:null}</td><td className="px-2 py-2 text-center tabular-nums text-amber-700">{Math.max(0,weightLoss).toFixed(2)}</td></tr></tfoot>
          </table>
        </div>
        </section>
      </div>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-5 py-3.5"><p className={`flex items-center gap-2 text-xs font-semibold ${valid?"text-emerald-700":"text-rose-700"}`}><span className={`h-2 w-2 rounded-full ${valid?"bg-emerald-500":"bg-rose-500"}`}/>{readOnly ? "View-only trip details" : validationMessage}</p><div className="flex gap-2"><button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="group inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 hover:shadow active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"><X size={16} className="transition-transform duration-200 group-hover:rotate-90"/>{readOnly ? "Close" : "Cancel"}</button>{!readOnly && <button type="button" onClick={()=>void save()} disabled={!valid||saving} className="group inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow-md active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transform-none"><Check className="transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3" size={16}/>{saving?"Saving…":"Save trip"}</button>}</div></footer>
    </section>
  </AppShellModal>;
}
