import MasterStatusBadge from "../../components/MasterStatusBadge";
import {
  Bird,
  Boxes,
  Hash,
  Settings2,
  Tag,
  ToggleLeft,
  Truck,
} from "lucide-react";
import type { Vehicle } from "../types/vehicle";
import { formatVehicleNumber } from "../../../../utils/format";
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
  masterRowClass,
  masterRowStyle,
  masterHeadTint as tint,
} from "../../components/masterTableStyles";

type VehicleTableProps = {
  vehicles: Vehicle[];
  onEdit: (item: Vehicle) => void;
  onDelete: (id: number) => void;
  emptyMessage?: string;
  loading?: boolean;
};

const COLS = 7;

function VehicleTable({
  vehicles,
  onEdit,
  onDelete,
  emptyMessage,
  loading = false,
}: VehicleTableProps) {
  const { t, language } = useI18n();
  const { requestDelete, cancel, pendingItems } = usePendingDelete(onDelete);
  // Telugu reaches the record text too; stored values stay untouched.
  const shown = (value: string | null | undefined) =>
    localizeTripViewText(value ?? "", language);
  const showLoadingRow = loading && vehicles.length === 0;
  const rows = vehicles;

  return (
    <>
      <MasterTable minWidth="min-w-[52rem]">
        <colgroup>
          <col className="w-[3.5rem]" />
          <col className="w-[11rem]" />
          <col className="w-[9rem]" />
          <col className="w-[7rem]" />
          <col className="w-[8rem]" />
          <col className="w-[6.5rem]" />
          <col className="w-[6.5rem]" />
        </colgroup>
        <MasterThead>
          <MasterTh
            icon={Hash}
            iconClass={tint.number}
            label={t("masters.dir.s_no")}
            align="center"
          />
          <MasterTh
            icon={Truck}
            iconClass={tint.vehicle}
            label={t("masters.dir.vehicle_no")}
          />
          <MasterTh
            icon={Tag}
            iconClass={tint.tag}
            label={t("masters.dir.type")}
          />
          <MasterTh
            icon={Boxes}
            iconClass={tint.capacity}
            label={t("masters.dir.boxes")}
            align="right"
          />
          <MasterTh
            icon={Bird}
            iconClass={tint.rate}
            label={t("masters.dir.bird_capacity")}
            align="right"
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
                {index + 1}
              </td>
              <td
                className={`${masterTdClass} whitespace-nowrap font-medium text-slate-800 tabular-nums`}
              >
                {formatVehicleNumber(f.vehicleNumber)}
              </td>
              <td className={masterTdClass}>
                <span className="block truncate">
                  {shown(f.vehicleType) || "—"}
                </span>
              </td>
              <td className={`${masterTdClass} text-right tabular-nums`}>
                {f.noOfBoxes}
              </td>
              <td className={`${masterTdClass} text-right tabular-nums`}>
                {f.birdCapacity}
              </td>
              <td className={`${masterTdClass} text-center`}>
                <MasterStatusBadge status={f.status} />
              </td>
              <td className={`${masterTdClass} text-center`}>
                <div className="inline-flex items-center gap-2">
                  <MasterEditButton
                    onClick={() => onEdit(f)}
                    ariaLabel={`Edit vehicle ${f.vehicleNumber}`}
                  />
                  <MasterDeleteButton
                    onClick={() =>
                      requestDelete(f.id, {
                        label: `Deleting Vehicle "${f.vehicleNumber}"`,
                      })
                    }
                    ariaLabel={`Delete vehicle ${f.vehicleNumber}`}
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

export default VehicleTable;
