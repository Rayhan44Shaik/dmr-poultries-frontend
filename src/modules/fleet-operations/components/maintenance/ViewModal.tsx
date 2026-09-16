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
  Hash, Truck, Calendar, Gauge, Cog, Wrench, Building2, UserCog, User,
  FileText, Paperclip, ChevronDown, CheckCircle2, Clock, XCircle, IndianRupee,
  Package, X, Pencil,
} from 'lucide-react';
import AppShellModal from '../../../../ui/AppShellModal';
import { useI18n, translateStatus } from '../../../../i18n';
import { uiActionIconMotionClass } from '../../../../shared/ui/uiTokens';
import { formatTripListDay } from '../../../operations/vehicle-trips/utils/formatTripListDay';
import type { MaintenanceEvent } from '../../types';
import MaintenanceDocuments from './MaintenanceDocuments';

interface ViewModalProps {
  record: MaintenanceEvent;
  vehicles: any[];
  onClose: () => void;
  /** Set when the record can still be edited — shows the in-view Edit action. */
  canEdit?: boolean;
  /** Edit from inside the view — closes the modal and loads the form. */
  onEdit?: (record: MaintenanceEvent) => void;
}

/** Icon-led definition cell — label over value, the shared detail style. */
function DetailCell({
  icon,
  label,
  children,
  className = '',
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 rounded-xl border border-slate-100 bg-slate-50/50 px-3.5 py-3 ${className}`}>
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
        <span className="flex-shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </p>
      <div className="mt-1 truncate text-[13px] font-semibold text-slate-800">{children}</div>
    </div>
  );
}

const ViewModal: React.FC<ViewModalProps> = ({ record, vehicles, onClose, canEdit = false, onEdit }) => {
  const { t, language } = useI18n();
  // Documents section starts OPEN; the chevron hides/shows the gallery.
  const [docsOpen, setDocsOpen] = React.useState(true);

  const vehicle = vehicles.find((v: any) => String(v.id) === String(record.vehicleId));
  const vehicleNumber = vehicle?.vehicleNumber || record.vehicleNo || '—';
  const isApproved = record.paymentStatus === 'approved';
  const isDeleted = Boolean(record.deletedAt);

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

  const maintTypes = (record.maintenanceType || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const nextByType = record.nextServiceByType || {};
  const parts = Array.isArray(record.parts) ? record.parts : [];
  const documents = Array.isArray(record.documents) ? record.documents : [];
  const showEdit = Boolean(canEdit && onEdit && !isApproved && !isDeleted);

  return (
    <AppShellModal open onClose={onClose} ariaLabelledBy="maintenance-view-title" panelClassName="max-w-4xl">
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
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 md:px-8">
          {/* Identity band */}
          <div className="flex flex-wrap items-center gap-2.5 animate-fade-in-up">
            <span className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-bold ${
              isDeleted
                ? 'border-rose-100/80 bg-rose-50 text-rose-700'
                : isApproved
                  ? 'border-emerald-100/80 bg-emerald-50 text-emerald-700'
                  : 'border-orange-100/80 bg-orange-50 text-orange-700'
            }`}>
              <Hash size={14} />
              {record.billNumber || '—'}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-xs">
              <Calendar size={14} className="flex-shrink-0 text-blue-500" />
              {formatTripListDay(record.date || record.createdAt, language)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-orange-100 bg-orange-50/60 px-3 py-1.5 text-sm font-bold text-slate-700 shadow-xs">
              <Gauge size={14} className="flex-shrink-0 text-orange-500" />
              {Number(record.currentKM || 0).toLocaleString()} KM
            </span>
          </div>

          {/* Details grid — the who / where / what of the job */}
          <section className="animate-fade-in-up" style={{ animationDelay: '40ms' }}>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <Wrench size={14} className="flex-shrink-0 text-blue-500" />
              {t('fleet.maintenance_view.service_details')}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailCell icon={<User size={13} className="text-indigo-500" />} label={t('common.driver')}>
                {record.driverName || '—'}
              </DetailCell>
              <DetailCell icon={<Wrench size={13} className="text-purple-500" />} label={t('fleet.maintenance_form.service_type')}>
                {record.serviceType || '—'}
              </DetailCell>
              <DetailCell icon={<Building2 size={13} className="text-amber-500" />} label={t('operations.maintenance_garage')}>
                {record.garage || '—'}
              </DetailCell>
              <DetailCell icon={<UserCog size={13} className="text-cyan-500" />} label={t('fleet.maintenance_form.mechanic')}>
                {record.mechanic || '—'}
              </DetailCell>
              <DetailCell icon={<Cog size={13} className="text-slate-500" />} label={t('operations.maintenance_type')}>
                {maintTypes.length > 0 ? (
                  <span className="flex flex-wrap gap-1.5">
                    {maintTypes.map((type) => (
                      <span key={type} className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600 shadow-xs">
                        {type}
                      </span>
                    ))}
                  </span>
                ) : '—'}
              </DetailCell>
              <DetailCell icon={<Gauge size={13} className="text-cyan-500" />} label={t('fleet.maintenance_form.next_service_km')}>
                {maintTypes.length > 0 ? (
                  <span className="flex flex-wrap gap-1.5">
                    {maintTypes.map((type) => (
                      <span key={type} className="inline-flex items-center gap-1 rounded-md border border-cyan-100 bg-cyan-50/60 px-2 py-0.5 text-[11px] font-semibold text-cyan-700">
                        {type}: {nextByType[type] != null ? `${Number(nextByType[type]).toLocaleString()} KM` : '—'}
                      </span>
                    ))}
                  </span>
                ) : record.nextServiceKM
                  ? `${Number(record.nextServiceKM).toLocaleString()} KM`
                  : '—'}
              </DetailCell>
            </div>
            {record.remarks ? (
              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/50 px-3.5 py-3">
                <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <FileText size={13} className="flex-shrink-0 text-emerald-500" />
                  {t('common.remarks')}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-[13px] font-medium text-slate-700">{record.remarks}</p>
              </div>
            ) : null}
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
                ₹{Number(record.totalCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
            {docsOpen && documents.length > 0 && record.id && (
              <div className="mt-3 animate-fade-in-up">
                <MaintenanceDocuments maintenanceId={record.id} documents={documents} allowRemove={false} />
              </div>
            )}
          </section>
        </div>

        {/* Footer — gradient strip, Edit inside the view (trip close style) */}
        <div className="flex items-center justify-end gap-3 rounded-b-2xl border-t border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 px-6 py-4">
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

export default React.memo(ViewModal);
