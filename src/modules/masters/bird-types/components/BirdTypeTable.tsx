import MasterStatusBadge from "../../components/MasterStatusBadge";
import {
  Hash,
  Bird,
  FileText,
  Scale,
  Settings2,
  ToggleLeft,
} from "lucide-react";
import type { BirdType } from "../types/birdType";
import { usePendingDelete } from "../../../../hooks/usePendingDelete";
import { PendingDeleteNotification } from "../../../../components/common/PendingDeleteNotification";
import { useI18n } from "../../../../i18n";
import { localizeTripViewText } from "../../../operations/vehicle-trips/utils/tripViewLocalization";
import {
  MasterTable,
  MasterThead,
  MasterTh,
  MasterLoadingRow,
  MasterEmptyRow,
  MasterEditButton,
  MasterDeleteButton,
} from "../../components/MasterDirectory";
import {
  masterThClass,
  masterTdClass,
  masterNameTdClass,
  masterRowClass,
  masterRowStyle,
  masterHeadTint as tint,
} from "../../components/masterTableStyles";

type BirdTypeTableProps = {
  birdTypes: BirdType[];
  onEdit: (item: BirdType) => void;
  onDelete: (id: number) => void;
  emptyMessage?: string;
  loading?: boolean;
};

const COLS = 7;



function BirdTypeTable({
  birdTypes,
  onEdit,
  onDelete,
  emptyMessage,
  loading = false,
}: BirdTypeTableProps) {
  const { t, language } = useI18n();
  const { requestDelete, cancel, pendingItems } = usePendingDelete(onDelete);
  // Telugu reaches the record text too; stored values stay untouched.
  const shown = (value: string | null | undefined) =>
    localizeTripViewText(value ?? "", language);
  const showLoadingRow = loading && birdTypes.length === 0;
  const rows = [...birdTypes].sort((a, b) =>
    a.birdTypeNo > b.birdTypeNo ? 1 : -1,
  );

  return (
    <>
      <MasterTable minWidth="min-w-[66rem]">
        <colgroup>
          <col className="w-[3.5rem]" />
          <col className="w-[13rem]" />
          <col className="w-[8.5rem]" />
          <col className="w-[10rem]" />
          <col className="w-[16rem]" />
          <col className="w-[6.5rem]" />
          <col className="w-[6.5rem]" />
        </colgroup>
        <MasterThead>
          <MasterTh icon={Hash} iconClass={tint.number} label={t("masters.dir.s_no")} align="center" />
          <MasterTh
            icon={Bird}
            iconClass={tint.name}
            label="Name"
          />
          <th className={`${masterThClass} text-center`}>Type</th>
          <MasterTh
            icon={Scale}
            iconClass={tint.rate}
            label="Weight / Contact"
          />
          <MasterTh
            icon={FileText}
            iconClass={tint.tag}
            label="Details"
          />
          <MasterTh
            icon={ToggleLeft}
            iconClass={tint.status}
            label={t("masters.dir.status")}
            align="center"
          />
          <MasterTh
            icon={Settings2}
            iconClass={tint.action}
            label={t("masters.dir.actions")}
            align="center"
          />
        </MasterThead>
        <tbody className="divide-y divide-slate-100">
          {showLoadingRow && (
            <MasterLoadingRow colSpan={COLS} label={t("masters.dir.loading")} />
          )}
          {!showLoadingRow && rows.length === 0 && (
            <MasterEmptyRow
              colSpan={COLS}
              label={emptyMessage ?? t("masters.dir.no_records")}
            />
          )}
          {rows.map((f, index) => (
            <tr
              key={f.id}
              className={masterRowClass(index, loading)}
              style={masterRowStyle(index)}
            >
              <td className={`${masterTdClass} text-center tabular-nums text-slate-500`}>{f.birdTypeNo}</td>
              <td className={masterNameTdClass}>
                <span className="block truncate">{shown(f.birdType)}</span>
              </td>
              <td className={`${masterTdClass} text-center`}><span className={`inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-semibold ${f.category === "Fuel Bunk" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{shown(f.category)}</span></td>
              {f.category === "Fuel Bunk" ? (
                <td className={`${masterTdClass} text-center`}>
                  <span className="block font-semibold">{shown(f.ownerName) || "—"}</span>
                  <span className="block text-xs tabular-nums text-slate-500">{f.mobileNumber || "—"}</span>
                </td>
              ) : (
                <td className={`${masterTdClass} whitespace-nowrap text-center tabular-nums`}>{`${f.averageWeight} kg`}</td>
              )}
              <td className={masterTdClass}>
                <span className="block truncate">
                  {f.category === "Fuel Bunk" ? shown(f.address) || "—" : shown(f.description) || "—"}
                </span>
              </td>
              <td className={`${masterTdClass} text-center`}>
                <MasterStatusBadge status={f.status} />
              </td>
              <td className={`${masterTdClass} text-center`}>
                <div className="inline-flex items-center gap-2">
                  <MasterEditButton
                    onClick={() => onEdit(f)}
                    ariaLabel={`Edit bird type ${f.birdType}`}
                  />
                  <MasterDeleteButton
                    onClick={() =>
                      requestDelete(f.id, {
                        label: `Deleting BirdType "${f.birdType}"`,
                      })
                    }
                    ariaLabel={`Delete bird type ${f.birdType}`}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </MasterTable>
      <PendingDeleteNotification items={pendingItems} onCancel={cancel} />
    </>
  );
}

export default BirdTypeTable;
