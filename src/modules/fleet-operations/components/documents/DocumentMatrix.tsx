import { memo } from 'react';
import { Edit } from 'lucide-react';
import { useI18n } from '../../../../i18n';

/** Vehicle fields this table renders. All optional so older callers keep working. */
interface MatrixVehicle {
  id: string | number;
  vehicleNumber: string;
  vehicleType?: string;
  chassisNumber?: string;
  engineNumber?: string;
  status?: string;
}

interface MatrixRow {
  vehicle: MatrixVehicle;
  docMap: Record<string, { expiryDate?: string } | undefined>;
}

interface DocumentMatrixProps {
  matrix: MatrixRow[];
  docTypes: string[];
  docLabels: Record<string, string>;
  getStatusColor: (expiryDate?: string) => string;
  formatExpiryDate: (dateStr?: string) => string;
  onEdit: (vehicle: MatrixRow['vehicle'], docMap: MatrixRow['docMap']) => void;
  /** Serial number of the first row on this page, so numbering is global
   * across pages instead of restarting at 1 on every page. */
  startSerial?: number;
}

const getExpiry = (doc: { expiryDate?: string } | undefined): string | undefined => doc?.expiryDate;

/* Typography mirrors the Trip Master / Trip Recent tables so every list in the
 * app reads the same: 11px bold uppercase headers on slate-50/80, 12px body
 * cells, slate-100 row dividers and a soft zebra stripe. */
const thLeft = 'px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider';
const thCenter = 'px-4 py-3 text-center text-[11px] font-bold uppercase tracking-wider';
const tdSerial = 'px-4 py-3 text-center text-xs text-slate-500 font-medium w-10';
const tdText = 'px-4 py-3 text-xs font-medium text-slate-700 whitespace-nowrap';
const tdMuted = 'px-4 py-3 text-xs text-slate-600 whitespace-nowrap';

const DocumentMatrix = ({
  matrix,
  docTypes,
  docLabels,
  getStatusColor,
  formatExpiryDate,
  onEdit,
  startSerial = 1,
}: DocumentMatrixProps) => {
  const { t } = useI18n();

  if (!matrix || matrix.length === 0) {
    return <div className="py-12 text-center text-slate-400 text-xs font-medium">No vehicles found.</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm text-left border-collapse">
        <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600">
          <tr className="whitespace-nowrap">
            <th className={`${thCenter} w-10`}>#</th>
            <th className={thLeft}>{t('common.vehicle')}</th>
            <th className={thLeft}>{t('fleet.chassis_no')}</th>
            <th className={thLeft}>{t('fleet.engine_no')}</th>
            {docTypes.map((type) => (
              <th key={type} className={thCenter}>
                {docLabels[type] || type}
              </th>
            ))}
            <th className={`${thCenter} w-[92px]`}>{t('common.actions')}</th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {matrix.map((row, index) => {
            const docMap = row.docMap || {};
            const vehicle = row.vehicle;
            const chassis = (vehicle.chassisNumber || '').trim();
            const engine = (vehicle.engineNumber || '').trim();

            return (
              <tr
                key={`${vehicle.id}-${vehicle.vehicleNumber}`}
                className={`group transition-all duration-150 hover:bg-slate-50/60 ${
                  index % 2 === 0 ? 'bg-white' : 'bg-slate-50/20'
                }`}
              >
                {/* Global serial number — continues across pages */}
                <td className={tdSerial}>{startSerial + index}</td>

                <td className={tdText}>{vehicle.vehicleNumber}</td>

                {/* Chassis and engine share one plain-text format, like the
                    identity columns of the trip tables. */}
                <td className={tdMuted}>{chassis || '—'}</td>
                <td className={tdMuted}>{engine || '—'}</td>

                {/* Expiry date only — the pill colour carries the status. */}
                {docTypes.map((type) => {
                  const expiry = getExpiry(docMap[type]);
                  return (
                    <td key={type} className="px-4 py-3 text-center whitespace-nowrap">
                      {expiry ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${getStatusColor(expiry)}`}
                        >
                          {formatExpiryDate(expiry)}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  );
                })}

                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onEdit(vehicle, docMap)}
                    title={t('fleet.doc_matrix.edit_documents')}
                    aria-label={`${t('fleet.doc_matrix.edit_documents')} — ${vehicle.vehicleNumber}`}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default memo(DocumentMatrix);
