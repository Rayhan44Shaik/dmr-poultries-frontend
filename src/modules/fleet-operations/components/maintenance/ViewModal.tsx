// src/modules/fleet-operations/components/maintenance/ViewModal.tsx
//
// Maintenance record view — the same global-view shell as the Trip List view
// (AppShellModal: overlay below the header, ESC to close, fade + scale panel).
// Covers EVERY detail of the record — identity, vehicle, all maintenance
// types, per-type next-service targets, parts, cost and documents — and works
// identically for Pending and Approved records. Documents are collapsible
// (show / hide) and open in the shared document lightbox. Edit lives INSIDE
// the view (never for approved / deleted / out-of-window records).

import React from 'react';
import {
  Truck, Wrench, Paperclip, ChevronDown, CheckCircle2, Clock,
  XCircle, IndianRupee, Package, X, Pencil, FileDown,
} from 'lucide-react';
import { generateMaintenancePdf } from '../../utils/generateMaintenancePdf';
import AppShellModal from '../../../../ui/AppShellModal';
import { ScopedI18nProvider } from '../../../../i18n';
import { ViewLanguageToggle } from '../../../../ui/ViewLanguageToggle';
import { uiPdfButtonClass } from '../../../../shared/ui/uiTokens';
import { useI18n, translateStatus } from '../../../../i18n';
import { uiActionIconMotionClass } from '../../../../shared/ui/uiTokens';
import { formatTripListDay } from '../../../operations/vehicle-trips/utils/formatTripListDay';
import { formatVehicleNumber } from '../../../../utils/format';
import { localizeMaintenanceText, localizeMaintenanceName } from '../../utils/maintenanceLocalization';
import type { MaintenanceEvent } from '../../types';
import MaintenanceDocuments from './MaintenanceDocuments';
import MasterDropdown from '../../../masters/components/MasterDropdown';
import { MAINTENANCE_TYPES } from '../../utils/constants';

interface ViewModalProps {
  record: MaintenanceEvent;
  vehicles: any[];
  onClose: () => void;
  /** EVERY maintenance record of this vehicle till now (newest first) —
   *  shown below the details like the collection shop view. */
  vehicleHistory?: MaintenanceEvent[];
  /** Set when the record can still be edited — shows the in-view Edit action. */
  canEdit?: boolean;
  /** Edit from inside the view — closes the modal and loads the form. */
  onEdit?: (record: MaintenanceEvent) => void;
}

const ViewModalInner: React.FC<ViewModalProps> = ({ record, vehicles, onClose, canEdit = false, onEdit, vehicleHistory = [] }) => {
  const { t, language, toggleLanguage } = useI18n();
  // Documents section starts OPEN; the chevron hides/shows the gallery.
  const [docsOpen, setDocsOpen] = React.useState(true);
  // Left panel filter — narrow the vehicle's approved list by type.
  const [typeFilter, setTypeFilter] = React.useState('');
  const [pdfBusy, setPdfBusy] = React.useState(false);
  // The record whose details are displayed. Clicking a row in the vehicle's
  // full history swaps it in — the view-collection interaction. When the
  // parent opens a different record, state resets during render (the React
  // recommended "adjust state on prop change" pattern — no effect needed).
  const [active, setActive] = React.useState(record);
  const [lastRecord, setLastRecord] = React.useState(record);
  if (record !== lastRecord) {
    setLastRecord(record);
    setActive(record);
  }

  /** LEFT PANEL list — every APPROVED maintenance entry of this vehicle,
   *  newest first, narrowable by type. Pending/deleted never appear here. */
  const approvedHistory = React.useMemo(
    () =>
      vehicleHistory.filter(
        (r) => r.paymentStatus === 'approved' && !r.deletedAt &&
          (!typeFilter || (r.maintenanceType || '').split(',').map((x) => x.trim()).includes(typeFilter))
      ),
    [vehicleHistory, typeFilter]
  );

  // Roving focus for the left list — ArrowUp/Down moves the active record.
  const listRefs = React.useRef(new Map<string, HTMLButtonElement>());
  const moveActive = (fromId: string, step: 1 | -1) => {
    const index = approvedHistory.findIndex((r) => String(r.id) === fromId);
    const next = approvedHistory[index + step];
    if (!next) return;
    setActive(next);
    const element = listRefs.current.get(String(next.id));
    if (element) {
      element.focus();
      element.scrollIntoView({ block: 'nearest' });
    }
  };

  const vehicle = vehicles.find((v: any) => String(v.id) === String(active.vehicleId));
  const vehicleNumber = formatVehicleNumber(vehicle?.vehicleNumber || active.vehicleNo || '');

  const handlePdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      await generateMaintenancePdf(active, vehicleHistory, vehicleNumber, language, t, vehicle);
    } finally {
      setPdfBusy(false);
    }
  };
  const isApproved = active.paymentStatus === 'approved';
  const isDeleted = Boolean(active.deletedAt);

  const statusLabel = isApproved
    ? translateStatus(t, 'Approved')
    : isDeleted
      ? translateStatus(t, 'Deleted')
      : translateStatus(t, 'Pending');

  const statusPill = isApproved
    ? { cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: <CheckCircle2 size={13} /> }
    : isDeleted
      ? { cls: 'text-rose-700 bg-rose-50 border-rose-200', icon: <XCircle size={13} /> }
      : { cls: 'text-blue-700 bg-blue-50 border-blue-200', icon: <Clock size={13} /> };

  const maintTypes = (active.maintenanceType || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const nextByType = active.nextServiceByType || {};
  const parts = Array.isArray(active.parts) ? active.parts : [];
  const documents = Array.isArray(active.documents) ? active.documents : [];
  const showEdit = Boolean(canEdit && onEdit && !isApproved && !isDeleted);

  return (
    <AppShellModal open onClose={onClose} ariaLabelledBy="maintenance-view-title" panelClassName="max-w-5xl">
      <div className="flex max-h-[calc(100vh-96px)] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl animate-scale-in">
        {/* Header — identity + status (same strip as the trip view) */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 px-6 py-4">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50/70 text-blue-500 shadow-inner">
              <Wrench className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 id="maintenance-view-title" className="truncate text-base font-bold tracking-tight text-slate-800">
                {t('fleet.maintenance_view.record_title')}
              </h2>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                <Truck size={13} className="flex-shrink-0 text-slate-400" />
                {vehicleNumber}
              </p>
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold shadow-sm ${statusPill.cls}`}>
              {statusPill.icon}
              {statusLabel}
            </span>
            {/* Popup-scoped language — same toggle as the trip view */}
            <ViewLanguageToggle
              language={language}
              onToggle={toggleLanguage}
              tone="emerald"
              labelMode="target"
              ariaLabel={t('fleet.maintenance_view.popup_language_toggle')}
            />
            {/* Trip-view close: white circle, red on hover, lifts on hover */}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="group relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-100 hover:bg-red-50 hover:text-red-500 active:scale-95"
            >
              <span className={`inline-flex ${uiActionIconMotionClass.close}`}><X size={16} /></span>
            </button>
          </div>
        </div>

        {/* Body — every detail of the record, sections fade in like the trip view */}
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          {/* LEFT — every APPROVED maintenance entry of this vehicle:
              date + maintenance type only, filterable, click to view. */}
          <aside className="flex w-full flex-shrink-0 flex-col border-b border-slate-100 bg-slate-50/40 lg:w-80 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between px-4 pt-4">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <Truck size={13} className="flex-shrink-0 text-slate-400" />
                {t('fleet.maintenance_view.all_records')}
              </p>
              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold tabular-nums text-slate-500 ring-1 ring-slate-200">
                {approvedHistory.length}
              </span>
            </div>
            <div className="px-3 pt-2.5">
              <MasterDropdown
                hideLabel
                label={t('operations.maintenance_type')}
                value={typeFilter}
                options={[
                  { value: '', label: t('common.all') },
                  ...MAINTENANCE_TYPES.map((type) => ({ value: type, label: type })),
                ]}
                onChange={(next) => setTypeFilter(next || '')}
                placeholder={t('operations.maintenance_type')}
                searchable
                allowClear
                className="w-full"
              />
            </div>
            <div className="max-h-56 min-h-0 flex-1 overflow-y-auto p-3 lg:max-h-none">
              {approvedHistory.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-slate-400">
                  {t('fleet.maintenance_table.no_approved')}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {approvedHistory.map((sub) => {
                    const rowActive = String(sub.id) === String(active.id);
                    const typeCount = (sub.maintenanceType || '').split(',').filter((x) => x.trim()).length;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        ref={(element) => {
                          if (element) listRefs.current.set(String(sub.id), element);
                          else listRefs.current.delete(String(sub.id));
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                            event.preventDefault();
                            moveActive(String(sub.id), event.key === 'ArrowDown' ? 1 : -1);
                          }
                        }}
                        onClick={() => setActive(sub)}
                        className={`w-full rounded-xl border px-3 py-2.5 text-left outline-none transition-all focus-visible:border-blue-300 focus-visible:ring-2 focus-visible:ring-blue-200 ${
                          rowActive
                            ? 'border-blue-200 bg-white shadow-sm ring-1 ring-blue-200'
                            : 'border-transparent hover:border-slate-200 hover:bg-white/70'
                        }`}
                      >
                        <p className="text-xs font-bold text-slate-700">
                          {formatTripListDay(sub.date || sub.createdAt, language)}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
                          {(sub.maintenanceType || '—').split(',')[0]}
                          {typeCount > 1 ? ` · +${typeCount - 1}` : ''}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          {/* RIGHT — the selected record: bill number, every detail, parts,
              total and the documents. */}
          <div className="min-w-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 md:px-8">
          {/* Vehicle master details — registration identity of the vehicle */}
          <section className="overflow-hidden rounded-xl border border-slate-200 animate-fade-in-up">
            <p className="flex items-center gap-1.5 bg-slate-50/80 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <Truck size={13} className="flex-shrink-0 text-blue-500" />
              {t('fleet.maintenance_view.vehicle_details')}
            </p>
            <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-y-0">
              {([
                [t('operations.vehicle_no'), vehicleNumber],
                [t('fleet.vehicle_type'), vehicle?.vehicleType || '—'],
                [t('fleet.engine_no'), vehicle?.engineNumber || '—'],
                [t('fleet.chassis_no'), vehicle?.chassisNumber || '—'],
              ] as [string, string][]).map(([label, value], index) => (
                <div
                  key={label}
                  className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
                    index % 2 === 0 ? 'sm:border-r sm:border-slate-100' : ''
                  } ${index < 2 ? 'border-b border-slate-100 sm:border-b' : ''} bg-white`}
                >
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
                  <span className="text-[13px] font-bold text-slate-800">{value}</span>
                </div>
              ))}
            </div>
          </section>

          {/* All record details — two EQUAL side-by-side columns of
              label/value rows (like the vehicle block). */}
          <section className="animate-fade-in-up" style={{ animationDelay: '40ms' }}>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
              {(() => {
                const rows: [string, string][] = [
                  [t('fleet.maintenance_view.bill_number'), active.billNumber || '—'],
                  [t('common.date'), formatTripListDay(active.date || active.createdAt, language)],
                  [t('common.vehicle'), vehicleNumber],
                  [t('fleet.maintenance_form.current_km'), `${Number(active.currentKM || 0).toLocaleString()} KM`],
                  [t('common.driver'), localizeMaintenanceName(active.driverName, language) || '—'],
                  [t('fleet.maintenance_form.service_type'), localizeMaintenanceText(active.serviceType, language) || '—'],
                  [t('operations.maintenance_garage'), localizeMaintenanceName(active.garage, language) || '—'],
                  [t('fleet.maintenance_form.mechanic'), localizeMaintenanceName(active.mechanic, language) || '—'],
                  [t('operations.maintenance_type'), maintTypes.length ? maintTypes.map((type) => localizeMaintenanceText(type, language)).join(', ') : '—'],
                  [t('fleet.maintenance_form.next_service_km'),
                    maintTypes.length
                      ? maintTypes.map((type) => `${localizeMaintenanceText(type, language)}: ${nextByType[type] != null ? `${Number(nextByType[type]).toLocaleString()} KM` : '—'}`).join(' · ')
                      : active.nextServiceKM ? `${Number(active.nextServiceKM).toLocaleString()} KM` : '—'],
                  [t('common.status'), statusLabel],
                  [t('common.remarks'), active.remarks || '—'],
                ];
                const half = Math.ceil(rows.length / 2);
                const column = (items: [string, string][], first: boolean) => (
                  <dl className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {items.map(([label, value], index) => (
                      <div
                        key={label}
                        className={`flex items-start justify-between gap-4 px-4 py-2.5 ${
                          index > 0 ? 'border-t border-slate-100' : ''
                        } ${first ? 'lg:border-r lg:border-slate-100' : ''} hover:bg-slate-50/60 transition-colors`}
                      >
                        <dt className="w-28 flex-shrink-0 text-[11px] font-bold uppercase tracking-wider text-slate-400 pt-0.5">{label}</dt>
                        <dd className="min-w-0 flex-1 break-words text-right text-[13px] font-bold text-slate-800">{value}</dd>
                      </div>
                    ))}
                  </dl>
                );
                return (
                  <>
                    {column(rows.slice(0, half), true)}
                    {column(rows.slice(half), false)}
                  </>
                );
              })()}
            </div>
          </section>

          {/* Parts — full bill breakdown */}
          {parts.length > 0 && (
            <section className="animate-fade-in-up" style={{ animationDelay: '80ms' }}>
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <Package size={14} className="flex-shrink-0 text-slate-400" />
                {t('fleet.maintenance_form.parts_title')}
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-100 text-sm">
                  <thead className="bg-slate-50/75">
                    <tr>
                      <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('fleet.parts.item_name')}</th>
                      <th className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('fleet.parts.specification')}</th>
                      <th className="px-3 py-2 text-center text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('fleet.parts.qty')}</th>
                      <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('fleet.parts.rate')}</th>
                      <th className="px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('fleet.parts.amount')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 bg-white">
                    {parts.map((part, index) => (
                      <tr key={index} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-3 py-2 text-[13px] font-semibold text-slate-700">{part.name || '—'}</td>
                        <td className="px-3 py-2 text-xs text-slate-500">{part.specification || '—'}</td>
                        <td className="px-3 py-2 text-center text-xs font-bold text-slate-700 tabular-nums">{part.quantity}</td>
                        <td className="px-3 py-2 text-right text-xs text-slate-600 tabular-nums">₹{Number(part.rate || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-right text-xs font-bold text-slate-800 tabular-nums">₹{Number(part.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Total cost band */}
          <section className="animate-fade-in-up" style={{ animationDelay: '120ms' }}>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/50 px-4 py-3">
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                <IndianRupee size={15} className="flex-shrink-0" />
                {t('fleet.parts.total_cost')}
              </span>
              <span className="text-lg font-bold tabular-nums text-emerald-700">
                ₹{Number(active.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </section>

          {/* Documents — collapsible show/hide, opens the shared lightbox */}
          <section className="animate-fade-in-up" style={{ animationDelay: '160ms' }}>
            <button
              type="button"
              onClick={() => setDocsOpen((open) => !open)}
              aria-expanded={docsOpen}
              className="group flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 transition hover:bg-slate-100/70"
            >
              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <Paperclip size={14} className="flex-shrink-0 text-slate-400" />
                {documents.length > 0
                  ? t('fleet.maintenance_view.documents_count', { count: documents.length })
                  : t('fleet.maintenance_docs.no_documents')}
              </span>
              <span className={`inline-flex text-slate-400 transition-transform duration-200 ${docsOpen ? 'rotate-180' : ''}`}>
                <ChevronDown size={16} />
              </span>
            </button>
            {docsOpen && documents.length > 0 && active.id && (
              <div className="mt-3 animate-fade-in-up">
                <MaintenanceDocuments maintenanceId={active.id} documents={documents} allowRemove={false} />
              </div>
            )}
          </section>
          </div>
        </div>

        {/* Footer — gradient strip, Edit inside the view (trip close style) */}
        <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 px-6 py-4">
          {/* PDF — the full record + the vehicle's complete history, table form */}
          <button
            type="button"
            onClick={handlePdf}
            disabled={pdfBusy}
            className={`group relative ${uiPdfButtonClass} disabled:opacity-60`}
            aria-label="PDF"
          >
            {pdfBusy ? (
              <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-rose-200 border-t-rose-500" aria-hidden="true" />
            ) : (
              <span className={`inline-flex ${uiActionIconMotionClass.pdf}`}><FileDown size={15} /></span>
            )}
            PDF
          </button>
          {showEdit && (
            <button
              type="button"
              onClick={() => onEdit?.(record)}
              className="group relative inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-blue-700 active:scale-95"
            >
              <span className={`inline-flex ${uiActionIconMotionClass.edit}`}><Pencil size={15} /></span>
              {t('common.edit')}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="group relative inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-6 py-2.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-200 active:scale-95"
            aria-label={t('common.close')}
          >
            <span className={`inline-flex ${uiActionIconMotionClass.close}`}><X size={15} /></span>
            {t('common.close')}
          </button>
        </div>
      </div>
    </AppShellModal>
  );
};

function ScopedViewModal(props: ViewModalProps) {
  const { language } = useI18n();
  return (
    <ScopedI18nProvider initialLanguage={language}>
      <ViewModalInner {...props} />
    </ScopedI18nProvider>
  );
}

export default React.memo(ScopedViewModal);
