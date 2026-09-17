import { memo } from "react";
import {
  Hash,
  Truck,
  Barcode,
  Cog,
  FileText,
  Shield,
  Dumbbell,
  FileCheck,
  Car,
  Settings2,
  Pencil,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "../../../../i18n";
import { formatVehicleNumber } from "../../../../utils/format";
import { uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";

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
  onEdit: (vehicle: MatrixRow["vehicle"], docMap: MatrixRow["docMap"]) => void;
  /** Serial number of the first row on this page, so numbering is global
   * across pages instead of restarting at 1 on every page. */
  startSerial?: number;
  /** Trip-List behaviour: the head stays put and only the record surface
   * shows a spinner row while data is fetched. */
  loading?: boolean;
  emptyMessage?: string;
}

const getExpiry = (
  doc: { expiryDate?: string } | undefined,
): string | undefined => doc?.expiryDate;

/** Same head-glyph tint per document type as the KPI tiles and edit modal. */
const DOC_HEAD: Record<string, { icon: LucideIcon; tint: string }> = {
  rc: { icon: FileText, tint: "text-indigo-500" },
  insurance: { icon: Shield, tint: "text-blue-500" },
  fitness: { icon: Dumbbell, tint: "text-emerald-500" },
  permit: { icon: FileCheck, tint: "text-amber-500" },
  puc: { icon: Car, tint: "text-purple-500" },
};

/* Trip List table anatomy — 12px bold uppercase heads with a coloured glyph,
 * 13px non-bold cells, py-5 rhythm, zebra + hover, staggered fade-in. */
const thBase =
  "px-4 py-4 text-[12px] font-bold uppercase tracking-wider leading-tight align-middle";
const tdBase = "px-4 py-5 align-middle text-[13px] text-slate-600";

function Head({
  icon: Icon,
  tint,
  label,
  align = "left",
}: {
  icon: LucideIcon;
  tint: string;
  label: string;
  align?: "left" | "center";
}) {
  return (
    <th
      className={`${thBase} ${align === "center" ? "text-center" : "text-left"}`}
    >
      <div
        className={`flex items-center gap-1.5 ${align === "center" ? "justify-center" : ""}`}
      >
        <Icon
          size={14}
          className={`${tint} flex-shrink-0`}
          aria-hidden="true"
        />
        <span>{label}</span>
      </div>
    </th>
  );
}

const DocumentMatrix = ({
  matrix,
  docTypes,
  docLabels,
  getStatusColor,
  formatExpiryDate,
  onEdit,
  startSerial = 1,
  loading = false,
  emptyMessage,
}: DocumentMatrixProps) => {
  const { t } = useI18n();
  const cols = 5 + docTypes.length;
  const showLoadingRow = loading && matrix.length === 0;

  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-[72rem] w-full table-fixed text-[13px] text-left border-collapse">
        <colgroup>
          <col className="w-[3.5rem]" />
          <col className="w-[9.5rem]" />
          <col className="w-[10rem]" />
          <col className="w-[9rem]" />
          {docTypes.map((type) => (
            <col key={type} className="w-[8.5rem]" />
          ))}
          <col className="w-[5.5rem]" />
        </colgroup>
        <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600">
          <tr>
            <Head icon={Hash} tint="text-slate-400" label="#" align="center" />
            <Head
              icon={Truck}
              tint="text-blue-500"
              label={t("common.vehicle")}
            />
            <Head
              icon={Barcode}
              tint="text-sky-500"
              label={t("fleet.chassis_no")}
            />
            <Head
              icon={Cog}
              tint="text-teal-500"
              label={t("fleet.engine_no")}
            />
            {docTypes.map((type) => {
              const visual = DOC_HEAD[type] ?? DOC_HEAD.rc;
              return (
                <Head
                  key={type}
                  icon={visual.icon}
                  tint={visual.tint}
                  label={docLabels[type] || type}
                  align="center"
                />
              );
            })}
            <Head
              icon={Settings2}
              tint="text-slate-500"
              label={t("common.actions")}
              align="center"
            />
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {showLoadingRow && (
            <tr>
              <td
                colSpan={cols}
                className="py-16 text-center text-sm font-medium text-slate-400"
              >
                <span
                  className="inline-flex items-center gap-2.5"
                  role="status"
                  aria-live="polite"
                >
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600"
                    aria-hidden="true"
                  />
                  {t("fleet.documents.loading")}
                </span>
              </td>
            </tr>
          )}
          {!showLoadingRow && matrix.length === 0 && (
            <tr>
              <td
                colSpan={cols}
                className="py-12 text-center text-slate-400 text-[13px] font-medium"
              >
                {emptyMessage ?? t("fleet.documents.no_vehicles_match")}
              </td>
            </tr>
          )}
          {matrix.map((row, index) => {
            const docMap = row.docMap || {};
            const vehicle = row.vehicle;
            const chassis = (vehicle.chassisNumber || "").trim();
            const engine = (vehicle.engineNumber || "").trim();

            return (
              <tr
                key={`${vehicle.id}-${vehicle.vehicleNumber}`}
                className={`transition-colors duration-150 hover:bg-slate-50/60 motion-safe:animate-[var(--animate-fade-in-up)] ${
                  index % 2 === 0 ? "bg-white" : "bg-slate-50/20"
                } ${loading ? "opacity-60" : ""}`}
                style={{ animationDelay: `${Math.min(index, 12) * 24}ms` }}
              >
                <td
                  className={`${tdBase} text-center tabular-nums text-slate-500`}
                >
                  {startSerial + index}
                </td>
                <td
                  className={`${tdBase} whitespace-nowrap font-medium text-slate-800 tabular-nums`}
                >
                  {formatVehicleNumber(vehicle.vehicleNumber)}
                </td>
                <td className={`${tdBase} whitespace-nowrap tabular-nums`}>
                  <span className="block truncate">{chassis || "—"}</span>
                </td>
                <td className={`${tdBase} whitespace-nowrap tabular-nums`}>
                  <span className="block truncate">{engine || "—"}</span>
                </td>

                {/* Expiry date only — the pill colour carries the status. */}
                {docTypes.map((type) => {
                  const expiry = getExpiry(docMap[type]);
                  return (
                    <td
                      key={type}
                      className={`${tdBase} text-center whitespace-nowrap`}
                    >
                      {expiry ? (
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums ${getStatusColor(expiry)}`}
                        >
                          {formatExpiryDate(expiry)}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  );
                })}

                <td className={`${tdBase} text-center`}>
                  <button
                    type="button"
                    onClick={() => onEdit(vehicle, docMap)}
                    aria-label={`${t("fleet.doc_matrix.edit_documents")} — ${vehicle.vehicleNumber}`}
                    className="group inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 bg-blue-50/70 text-blue-600 transition-all hover:-translate-y-0.5 hover:bg-blue-100 hover:shadow-sm active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
                  >
                    <span
                      className={`inline-flex ${uiActionIconMotionClass.edit}`}
                    >
                      <Pencil size={14} />
                    </span>
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
