import React, { useCallback, useRef } from "react";
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Gauge,
  Hash,
  IndianRupee,
  Paperclip,
  Store,
  Truck,
  User,
  Wrench,
  XCircle,
} from "lucide-react";
import { useI18n, translateStatus } from "../../../../i18n";
import { formatVehicleNumber } from "../../../../utils/format";
import { formatTripListDay } from "../../../operations/vehicle-trips/utils/formatTripListDay";
import {
  localizeMaintenanceName,
  localizeMaintenanceText,
} from "../../utils/maintenanceLocalization";
import type { MaintenanceEvent } from "../../types";
import type { Vehicle } from "../../../masters/vehicles/types/vehicle";

export type MaintenanceSortKey =
  | "billNumber"
  | "date"
  | "vehicleNo"
  | "driverName"
  | "maintenanceType"
  | "serviceType"
  | "currentKM"
  | "totalCost"
  | "status";

type Props = {
  records: readonly MaintenanceEvent[];
  vehicles: readonly Vehicle[];
  isLoading: boolean;
  selectedRecordId: string | null;
  onRowClick: (record: MaintenanceEvent) => void;
  onRowSelect: (record: MaintenanceEvent) => void;
  startIndex: number;
  sortBy: MaintenanceSortKey | null;
  sortDir: "asc" | "desc";
  onSortChange: (key: MaintenanceSortKey) => void;
};

function maintenanceStatus(
  record: MaintenanceEvent,
): "Approved" | "Pending" | "Deleted" {
  if (record.deletedAt) return "Deleted";
  return record.paymentStatus === "approved" ? "Approved" : "Pending";
}

function StatusPill({ record }: { record: MaintenanceEvent }) {
  const { t } = useI18n();
  const status = maintenanceStatus(record);
  const style =
    status === "Approved"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "Deleted"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
  const Icon =
    status === "Approved"
      ? CheckCircle2
      : status === "Deleted"
        ? XCircle
        : Clock;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${style}`}
    >
      <Icon size={12} aria-hidden="true" />
      {translateStatus(t, status)}
    </span>
  );
}

/**
 * The Maintenance List table follows the Trip List interaction contract:
 * keyboard-accessible rows select a record, a clear selected state is shown in
 * the first column, and header sorting never changes the current filter set.
 */
function MaintenanceMasterTable({
  records,
  vehicles,
  isLoading,
  selectedRecordId,
  onRowClick,
  onRowSelect,
  startIndex,
  sortBy,
  sortDir,
  onSortChange,
}: Props) {
  const { t, language } = useI18n();
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());

  const resolveVehicleNumber = useCallback(
    (record: MaintenanceEvent) => {
      const vehicle = vehicles.find(
        (item) => String(item.id) === String(record.vehicleId),
      );
      const number = vehicle?.vehicleNumber || record.vehicleNo || "";
      return number ? formatVehicleNumber(String(number)) : "—";
    },
    [vehicles],
  );

  const selectRow = useCallback(
    (record: MaintenanceEvent) => onRowSelect(record),
    [onRowSelect],
  );

  const handleRowKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableRowElement>, index: number) => {
      if (event.target !== event.currentTarget) return;
      const current = records[index];
      if (!current) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectRow(current);
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      const next = records[index + (event.key === "ArrowDown" ? 1 : -1)];
      if (!next?.id) return;
      selectRow(next);
      requestAnimationFrame(() =>
        rowRefs.current.get(String(next.id))?.focus(),
      );
    },
    [records, selectRow],
  );

  const sortLabel = (
    key: MaintenanceSortKey,
    label: React.ReactNode,
    center = false,
  ) => {
    const active = sortBy === key;
    return (
      <button
        type="button"
        onClick={() => onSortChange(key)}
        aria-sort={
          active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
        }
        className={`group/sort inline-flex w-full items-center gap-1.5 text-left text-[11px] font-bold uppercase tracking-wider transition-colors hover:text-emerald-700 ${
          center ? "justify-center" : ""
        } ${active ? "text-emerald-700" : "text-slate-600"}`}
      >
        {label}
        <span
          aria-hidden="true"
          className={`text-[10px] leading-none transition-opacity ${active ? "opacity-100" : "opacity-30 group-hover/sort:opacity-70"}`}
        >
          {active && sortDir === "desc" ? "↓" : "↑"}
        </span>
      </button>
    );
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-[1060px] w-full border-collapse text-left text-[13px]">
        <thead className="border-b border-slate-200 bg-slate-50/80 text-slate-600">
          <tr className="whitespace-nowrap">
            <th className="w-12 px-4 py-4 text-center text-[11px] font-bold uppercase tracking-wider">
              #
            </th>
            <th className="px-4 py-4">
              {sortLabel(
                "billNumber",
                <span className="flex items-center gap-1.5">
                  <Hash size={14} className="text-slate-400" />
                  {t("fleet.maintenance_table.mnt_no")}
                </span>,
              )}
            </th>
            <th className="px-4 py-4">
              {sortLabel(
                "date",
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-blue-500" />
                  {t("common.date")}
                </span>,
              )}
            </th>
            <th className="px-4 py-4">
              {sortLabel(
                "vehicleNo",
                <span className="flex items-center gap-1.5">
                  <Truck size={14} className="text-indigo-500" />
                  {t("common.vehicle")}
                </span>,
              )}
            </th>
            <th className="px-4 py-4">
              {sortLabel(
                "driverName",
                <span className="flex items-center gap-1.5">
                  <User size={14} className="text-emerald-500" />
                  {t("common.driver")}
                </span>,
              )}
            </th>
            <th className="px-4 py-4">
              {sortLabel(
                "maintenanceType",
                <span className="flex items-center gap-1.5">
                  <Wrench size={14} className="text-violet-500" />
                  {t("fleet.maintenance_table.maintenance_details")}
                </span>,
              )}
            </th>
            <th className="px-4 py-4">
              {sortLabel(
                "serviceType",
                <span className="flex items-center gap-1.5">
                  <Store size={14} className="text-amber-500" />
                  {t("fleet.maintenance_form.service_type")}
                </span>,
              )}
            </th>
            <th className="px-4 py-4 text-right">
              {sortLabel(
                "currentKM",
                <span className="flex items-center justify-end gap-1.5">
                  <Gauge size={14} className="text-cyan-500" />
                  KM
                </span>,
                true,
              )}
            </th>
            <th className="px-4 py-4 text-right">
              {sortLabel(
                "totalCost",
                <span className="flex items-center justify-end gap-1.5">
                  <IndianRupee size={14} className="text-violet-500" />
                  {t("fleet.maintenance_history.total_cost")}
                </span>,
                true,
              )}
            </th>
            <th className="px-4 py-4 text-center">
              {sortLabel("status", <span>{t("common.status")}</span>, true)}
            </th>
            <th className="px-4 py-4 text-center text-[11px] font-bold uppercase tracking-wider">
              {t("fleet.maintenance_history.documents")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {isLoading ? (
            <tr>
              <td
                colSpan={11}
                className="py-16 text-center text-sm font-medium text-slate-400"
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600"
                    aria-hidden="true"
                  />
                  {t("common.loading")}
                </span>
              </td>
            </tr>
          ) : records.length === 0 ? (
            <tr>
              <td
                colSpan={11}
                className="py-14 text-center text-[13px] font-medium text-slate-400"
              >
                <Wrench
                  size={22}
                  className="mx-auto mb-2 opacity-45"
                  aria-hidden="true"
                />
                {t("common.no_records")}
              </td>
            </tr>
          ) : (
            records.map((record, index) => {
              const id = String(record.id || "");
              const selected = id !== "" && id === selectedRecordId;
              const types = String(record.maintenanceType || "")
                .split(",")
                .map((type) => type.trim())
                .filter(Boolean);
              const primaryType = types[0] || "—";
              const documentCount = record.documents?.length || 0;

              return (
                <tr
                  key={id || `${record.billNumber}-${index}`}
                  ref={(element) => {
                    if (!id) return;
                    if (element) rowRefs.current.set(id, element);
                    else rowRefs.current.delete(id);
                  }}
                  tabIndex={0}
                  aria-selected={selected}
                  aria-label={`${record.billNumber || ""} ${resolveVehicleNumber(record)}`}
                  onClick={() => onRowClick(record)}
                  onKeyDown={(event) => handleRowKeyDown(event, index)}
                  className={`cursor-pointer outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-400 ${
                    selected
                      ? "border-l-4 border-l-blue-300 bg-blue-50/70 ring-1 ring-inset ring-blue-200"
                      : `border-l-4 border-l-transparent hover:bg-slate-50/75 ${index % 2 === 0 ? "bg-white" : "bg-slate-50/20"}`
                  }`}
                >
                  <td className="w-12 px-4 py-4 text-center text-[13px] font-medium text-slate-500">
                    {selected ? (
                      <Check
                        size={16}
                        className="inline text-blue-500"
                        aria-label={t("common.selected")}
                      />
                    ) : (
                      startIndex + index + 1
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[12px] font-bold text-emerald-700">
                      {record.billNumber || "—"}
                    </span>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap font-medium text-slate-600">
                    {formatTripListDay(
                      record.date || record.createdAt,
                      language,
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap font-semibold text-slate-700">
                    {resolveVehicleNumber(record)}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-slate-600">
                    {localizeMaintenanceName(
                      record.driverName || "",
                      language,
                    ) || "—"}
                  </td>
                  <td className="max-w-52 px-4 py-4">
                    <p className="truncate font-medium text-slate-700">
                      {localizeMaintenanceText(primaryType, language)}
                    </p>
                    {types.length > 1 ? (
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {t("fleet.maintenance_table.more", {
                          count: types.length - 1,
                        })}
                      </p>
                    ) : null}
                  </td>
                  <td className="max-w-40 px-4 py-4">
                    <p className="truncate text-slate-600">
                      {localizeMaintenanceText(
                        record.serviceType || "",
                        language,
                      ) || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-right font-semibold tabular-nums text-slate-700">
                    {Number(record.currentKM || 0).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-4 text-right font-bold tabular-nums text-violet-700">
                    ₹
                    {Number(record.totalCost || 0).toLocaleString("en-IN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-4 text-center whitespace-nowrap">
                    <StatusPill record={record} />
                  </td>
                  <td className="px-4 py-4 text-center whitespace-nowrap">
                    {documentCount ? (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-bold text-violet-600">
                        <Paperclip size={12} aria-hidden="true" />
                        {documentCount}
                      </span>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default React.memo(MaintenanceMasterTable);
