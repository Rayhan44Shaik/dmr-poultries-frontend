import MasterStatusBadge from "../../components/MasterStatusBadge";
import {
  Hash,
  MapPin,
  Phone,
  Settings2,
  ToggleLeft,
  User,
  UserCog,
  Warehouse,
} from "lucide-react";
import type { Farm } from "../types/farm";
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

type FarmTableProps = {
  farms: Farm[];
  onEdit: (item: Farm) => void;
  onDelete: (id: number) => void;
  emptyMessage?: string;
  loading?: boolean;
};

const COLS = 8;

function FarmTable({
  farms,
  onEdit,
  onDelete,
  emptyMessage,
  loading = false,
}: FarmTableProps) {
  const { t, language } = useI18n();
  const { requestDelete, cancel, pendingItems } = usePendingDelete(onDelete);
  // Telugu reaches the record text too; stored values stay untouched.
  const shown = (value: string | null | undefined) =>
    localizeTripViewText(value ?? "", language);
  const showLoadingRow = loading && farms.length === 0;
  const rows = [...farms].sort((a, b) => (a.farmNo > b.farmNo ? 1 : -1));

  return (
    <>
      <MasterTable minWidth="min-w-[64rem]">
        <colgroup>
          <col className="w-[3.5rem]" />
          <col className="w-[13rem]" />
          <col className="w-[10rem]" />
          <col className="w-[10rem]" />
          <col className="w-[9rem]" />
          <col className="w-[8rem]" />
          <col className="w-[6.5rem]" />
          <col className="w-[6.5rem]" />
        </colgroup>
        <MasterThead>
          <MasterTh
            icon={Hash}
            iconClass={tint.number}
            label={t("masters.dir.farm_no")}
            align="center"
          />
          <MasterTh
            icon={Warehouse}
            iconClass={tint.name}
            label={t("masters.dir.farm_name")}
          />
          <MasterTh
            icon={User}
            iconClass={tint.person}
            label={t("masters.dir.owner")}
          />
          <MasterTh
            icon={UserCog}
            iconClass={tint.tag}
            label={t("masters.dir.supervisor")}
          />
          <MasterTh
            icon={MapPin}
            iconClass={tint.place}
            label={t("masters.dir.village")}
          />
          <MasterTh
            icon={Phone}
            iconClass={tint.phone}
            label={t("masters.dir.phone")}
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
                {f.farmNo}
              </td>
              <td className={masterNameTdClass}>
                <span className="block truncate">{shown(f.farmName)}</span>
              </td>
              <td className={masterTdClass}>
                <span className="block truncate">
                  {shown(f.ownerName) || "—"}
                </span>
              </td>
              <td className={masterTdClass}>
                <span className="block truncate">
                  {shown(f.supervisorName) || "—"}
                </span>
              </td>
              <td className={masterTdClass}>
                <span className="block truncate">
                  {shown(f.village) || "—"}
                </span>
              </td>
              <td className={`${masterTdClass} whitespace-nowrap tabular-nums`}>
                {f.phoneNumber || "—"}
              </td>
              <td className={`${masterTdClass} text-center`}>
                <MasterStatusBadge status={f.status} />
              </td>
              <td className={`${masterTdClass} text-center`}>
                <div className="inline-flex items-center gap-2">
                  <MasterEditButton
                    onClick={() => onEdit(f)}
                    ariaLabel={`Edit farm ${f.farmName}`}
                  />
                  <MasterDeleteButton
                    onClick={() =>
                      requestDelete(f.id, {
                        label: `Deleting Farm "${f.farmName}"`,
                      })
                    }
                    ariaLabel={`Delete farm ${f.farmName}`}
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

export default FarmTable;
