import MasterStatusBadge from "../../components/MasterStatusBadge";
import {
  Bird,
  FileText,
  Hash,
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

const COLS = 6;

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
      <MasterTable minWidth="min-w-[46rem]">
        <colgroup>
          <col className="w-[4rem]" />
          <col className="w-[12rem]" />
          <col className="w-[8rem]" />
          <col className="w-[14rem]" />
          <col className="w-[6.5rem]" />
          <col className="w-[6.5rem]" />
        </colgroup>
        <MasterThead>
          <MasterTh
            icon={Hash}
            iconClass={tint.number}
            label={t("masters.dir.bird_type_no")}
            align="center"
          />
          <MasterTh
            icon={Bird}
            iconClass={tint.name}
            label={t("masters.dir.bird_type")}
          />
          <MasterTh
            icon={Scale}
            iconClass={tint.rate}
            label={t("masters.dir.avg_weight")}
            align="right"
          />
          <MasterTh
            icon={FileText}
            iconClass={tint.tag}
            label={t("masters.dir.description")}
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
              <td
                className={`${masterTdClass} text-center tabular-nums text-slate-500`}
              >
                {f.birdTypeNo}
              </td>
              <td className={masterNameTdClass}>
                <span className="block truncate">{shown(f.birdType)}</span>
              </td>
              <td className={`${masterTdClass} text-right tabular-nums`}>
                {f.averageWeight}
              </td>
              <td className={masterTdClass}>
                <span className="block truncate">
                  {shown(f.description) || "—"}
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
