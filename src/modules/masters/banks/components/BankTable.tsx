import MasterStatusBadge from "../../components/MasterStatusBadge";
import {
  AtSign,
  CreditCard,
  Hash,
  KeyRound,
  Landmark,
  MapPin,
  Settings2,
  ToggleLeft,
} from "lucide-react";
import type { Bank } from "../types/bank";
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

type BankTableProps = {
  banks: Bank[];
  onEdit: (item: Bank) => void;
  onDelete: (id: number) => void;
  emptyMessage?: string;
  loading?: boolean;
};

const COLS = 8;

function BankTable({
  banks,
  onEdit,
  onDelete,
  emptyMessage,
  loading = false,
}: BankTableProps) {
  const { t, language } = useI18n();
  const { requestDelete, cancel, pendingItems } = usePendingDelete(onDelete);
  // Telugu reaches the record text too; stored values stay untouched.
  const shown = (value: string | null | undefined) =>
    localizeTripViewText(value ?? "", language);
  const showLoadingRow = loading && banks.length === 0;
  const rows = [...banks].sort((a, b) => (a.bankNo > b.bankNo ? 1 : -1));

  return (
    <>
      <MasterTable minWidth="min-w-[66rem]">
        <colgroup>
          <col className="w-[4rem]" />
          <col className="w-[12rem]" />
          <col className="w-[9rem]" />
          <col className="w-[10rem]" />
          <col className="w-[8rem]" />
          <col className="w-[10rem]" />
          <col className="w-[6.5rem]" />
          <col className="w-[6.5rem]" />
        </colgroup>
        <MasterThead>
          <MasterTh
            icon={Hash}
            iconClass={tint.number}
            label={t("masters.dir.bank_no")}
            align="center"
          />
          <MasterTh
            icon={Landmark}
            iconClass={tint.bank}
            label={t("masters.dir.bank_name")}
          />
          <MasterTh
            icon={MapPin}
            iconClass={tint.place}
            label={t("masters.dir.branch")}
          />
          <MasterTh
            icon={CreditCard}
            iconClass={tint.tag}
            label={t("masters.dir.account_no")}
          />
          <MasterTh
            icon={KeyRound}
            iconClass={tint.code}
            label={t("masters.dir.ifsc")}
          />
          <MasterTh
            icon={AtSign}
            iconClass={tint.rate}
            label={t("masters.dir.upi")}
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
                {f.bankNo}
              </td>
              <td className={masterNameTdClass}>
                <span className="block truncate">{shown(f.bankName)}</span>
              </td>
              <td className={masterTdClass}>
                <span className="block truncate">{shown(f.branch) || "—"}</span>
              </td>
              <td className={`${masterTdClass} whitespace-nowrap tabular-nums`}>
                {f.accountNumber || "—"}
              </td>
              <td
                className={`${masterTdClass} whitespace-nowrap uppercase tabular-nums`}
              >
                {f.ifscCode || "—"}
              </td>
              <td className={masterTdClass}>
                <span className="block truncate">{f.upiId || "—"}</span>
              </td>
              <td className={`${masterTdClass} text-center`}>
                <MasterStatusBadge status={f.status} />
              </td>
              <td className={`${masterTdClass} text-center`}>
                <div className="inline-flex items-center gap-2">
                  <MasterEditButton
                    onClick={() => onEdit(f)}
                    ariaLabel={`Edit bank ${f.bankName}`}
                  />
                  <MasterDeleteButton
                    onClick={() =>
                      requestDelete(f.id, {
                        label: `Deleting Bank "${f.bankName}"`,
                      })
                    }
                    ariaLabel={`Delete bank ${f.bankName}`}
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

export default BankTable;
