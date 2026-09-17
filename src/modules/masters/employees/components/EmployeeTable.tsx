import MasterStatusBadge from "../../components/MasterStatusBadge";
import {
  Briefcase,
  Hash,
  IndianRupee,
  Phone,
  Settings2,
  ToggleLeft,
  User,
} from "lucide-react";
import type { Employee } from "../types/employee";
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

type EmployeeTableProps = {
  employees: Employee[];
  onEdit: (item: Employee) => void;
  onDelete: (id: number) => void;
  emptyMessage?: string;
  loading?: boolean;
};

const salaryFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
});
const formatSalary = (amount: number) => salaryFormatter.format(amount);

const COLS = 7;

function EmployeeTable({
  employees,
  onEdit,
  onDelete,
  emptyMessage,
  loading = false,
}: EmployeeTableProps) {
  const { t, language } = useI18n();
  const { requestDelete, cancel, pendingItems } = usePendingDelete(onDelete);
  // Telugu reaches the record text too; stored values stay untouched.
  const shown = (value: string | null | undefined) =>
    localizeTripViewText(value ?? "", language);
  const showLoadingRow = loading && employees.length === 0;
  const rows = [...employees].sort((a, b) =>
    a.employeeNo > b.employeeNo ? 1 : -1,
  );

  return (
    <>
      <MasterTable minWidth="min-w-[58rem]">
        <colgroup>
          <col className="w-[4.5rem]" />
          <col className="w-[13rem]" />
          <col className="w-[10rem]" />
          <col className="w-[8rem]" />
          <col className="w-[8rem]" />
          <col className="w-[6.5rem]" />
          <col className="w-[6.5rem]" />
        </colgroup>
        <MasterThead>
          <MasterTh
            icon={Hash}
            iconClass={tint.number}
            label={t("masters.dir.emp_no")}
            align="center"
          />
          <MasterTh
            icon={User}
            iconClass={tint.name}
            label={t("masters.dir.name")}
          />
          <MasterTh
            icon={Briefcase}
            iconClass={tint.tag}
            label={t("masters.dir.department")}
          />
          <MasterTh
            icon={Phone}
            iconClass={tint.phone}
            label={t("masters.dir.phone")}
          />
          <MasterTh
            icon={IndianRupee}
            iconClass={tint.money}
            label={t("masters.dir.salary")}
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
                {f.employeeNo}
              </td>
              <td className={masterNameTdClass}>
                <span className="block truncate">{shown(f.employeeName)}</span>
              </td>
              <td className={masterTdClass}>
                <span className="block truncate">
                  {shown(f.department) || "—"}
                </span>
              </td>
              <td className={`${masterTdClass} whitespace-nowrap tabular-nums`}>
                {f.phoneNumber || "—"}
              </td>
              <td
                className={`${masterTdClass} text-right whitespace-nowrap tabular-nums`}
              >
                {formatSalary(f.salary)}
              </td>
              <td className={`${masterTdClass} text-center`}>
                <MasterStatusBadge status={f.status} />
              </td>
              <td className={`${masterTdClass} text-center`}>
                <div className="inline-flex items-center gap-2">
                  <MasterEditButton
                    onClick={() => onEdit(f)}
                    ariaLabel={`Edit employee ${f.employeeName}`}
                  />
                  <MasterDeleteButton
                    onClick={() =>
                      requestDelete(f.id, {
                        label: `Deleting Employee "${f.employeeName}"`,
                      })
                    }
                    ariaLabel={`Delete employee ${f.employeeName}`}
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

export default EmployeeTable;
