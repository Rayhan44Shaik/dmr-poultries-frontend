import { Eye } from "lucide-react";
import { useMemo, useState } from "react";
import { useLanguage } from "../../../providers/languageContext";

type MasterRow = Record<string, unknown>;

type MasterDataTableProps = {
  moduleName: string;
  data: MasterRow[];
  onView?: (item: MasterRow) => void;
};

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function MasterDataTable({ moduleName, data, onView }: MasterDataTableProps) {
  const { t } = useLanguage();
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));

  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [page, data]);

  const badge = (status: string) => (
    <span
      className={
        "px-3 py-1 rounded-full text-xs font-semibold " +
        (status === "Active"
          ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
          : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300")
      }
    >
      {status === "Active" ? t("status.active") : t("status.inactive")}
    </span>
  );

  const viewButton = (item: MasterRow) => (
    <button
      onClick={() => onView?.(item)}
      className="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-100 hover:bg-blue-200 transition dark:bg-slate-700 dark:hover:bg-slate-600"
    >
      <Eye size={18} className="text-blue-700 dark:text-blue-300" />
    </button>
  );

  const th = (label: string) => <th className="px-5 py-4 text-left">{label}</th>;
  const thCenter = (label: string) => <th className="px-5 py-4 text-center">{label}</th>;
  const theadClass = "bg-slate-100 dark:bg-slate-700 dark:text-slate-200";
  const trClass = "border-b hover:bg-blue-50 dark:hover:bg-slate-700";
  const cell = (v: unknown) => <td className="px-5 py-4">{str(v)}</td>;
  const cellStrong = (v: unknown) => <td className="px-5 py-4 font-medium">{str(v)}</td>;

  const renderShopTable = () => (
    <table className="w-full">
      <thead className={theadClass}>
        <tr>
          {th(t("shops.shopNo"))}
          {th(t("shops.shopName"))}
          {th(t("shops.owner"))}
          {th(t("shops.mobile"))}
          {th(t("shops.village"))}
          {th(t("common.status"))}
          {thCenter(t("common.view"))}
        </tr>
      </thead>
      <tbody>
        {paginatedData.map((shop) => (
          <tr key={str(shop.id)} className={trClass}>
            {cell(shop.shopNo)}
            {cellStrong(shop.shopName)}
            {cell(shop.ownerName)}
            {cell(shop.phoneNumber)}
            {cell(shop.village)}
            <td className="px-5 py-4">{badge(str(shop.status))}</td>
            <td className="px-5 py-4 text-center">{viewButton(shop)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderFarmTable = () => (
    <table className="w-full">
      <thead className={theadClass}>
        <tr>
          {th(t("farms.farmNo"))}
          {th(t("farms.farmName"))}
          {th(t("shops.owner"))}
          {th(t("shops.village"))}
          {th(t("farms.capacity"))}
          {th(t("common.status"))}
          {thCenter(t("common.view"))}
        </tr>
      </thead>
      <tbody>
        {paginatedData.map((farm) => (
          <tr key={str(farm.id)} className={trClass}>
            {cell(farm.farmNo)}
            {cellStrong(farm.farmName)}
            {cell(farm.ownerName)}
            {cell(farm.village)}
            {cell(farm.capacity)}
            <td className="px-5 py-4">{badge(str(farm.status))}</td>
            <td className="px-5 py-4 text-center">{viewButton(farm)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderVehicleTable = () => (
    <table className="w-full">
      <thead className={theadClass}>
        <tr>
          {th(t("vehicles.vehicleNo"))}
          {th(t("vehicles.vehicleNumber"))}
          {th(t("vehicles.vehicleType"))}
          {th(t("vehicles.driver"))}
          {th(t("common.status"))}
          {thCenter(t("common.view"))}
        </tr>
      </thead>
      <tbody>
        {paginatedData.map((vehicle) => (
          <tr key={str(vehicle.id)} className={trClass}>
            {cell(vehicle.vehicleNo)}
            {cellStrong(vehicle.vehicleNumber)}
            {cell(vehicle.vehicleType)}
            {cell(vehicle.driverName)}
            <td className="px-5 py-4">{badge(str(vehicle.status))}</td>
            <td className="px-5 py-4 text-center">{viewButton(vehicle)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderEmployeeTable = () => (
    <table className="w-full">
      <thead className={theadClass}>
        <tr>
          {th(t("employees.employee"))}
          {th(t("employees.department"))}
          {th(t("shops.mobile"))}
          {th(t("employees.salary"))}
          {th(t("common.status"))}
          {thCenter(t("common.view"))}
        </tr>
      </thead>
      <tbody>
        {paginatedData.map((emp) => (
          <tr key={str(emp.id)} className={trClass}>
            {cellStrong(emp.employeeName)}
            {cell(emp.department)}
            {cell(emp.mobile)}
            {cell("₹ " + str(emp.salary))}
            <td className="px-5 py-4">{badge(str(emp.status))}</td>
            <td className="px-5 py-4 text-center">{viewButton(emp)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderBankTable = () => (
    <table className="w-full">
      <thead className={theadClass}>
        <tr>
          {th("Bank")}
          {th("Branch")}
          {th("IFSC")}
          {th(t("common.status"))}
          {thCenter(t("common.view"))}
        </tr>
      </thead>
      <tbody>
        {paginatedData.map((bank) => (
          <tr key={str(bank.id)} className={trClass}>
            {cellStrong(bank.bankName)}
            {cell(bank.branchName)}
            {cell(bank.ifscCode)}
            <td className="px-5 py-4">{badge(str(bank.status))}</td>
            <td className="px-5 py-4 text-center">{viewButton(bank)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderBirdTypeTable = () => (
    <table className="w-full">
      <thead className={theadClass}>
        <tr>
          {th("Bird No")}
          {th("Bird Type")}
          {th("Description")}
          {thCenter(t("common.view"))}
        </tr>
      </thead>
      <tbody>
        {paginatedData.map((bird) => (
          <tr key={str(bird.id)} className={trClass}>
            {cell(bird.birdTypeNo)}
            {cellStrong(bird.birdType)}
            {cell(bird.description)}
            <td className="px-5 py-4 text-center">{viewButton(bird)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderRouteTable = () => (
    <div className="py-24 text-center">
      <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-100">{t("masters.routes")} Module</h3>
      <p className="text-slate-500 mt-2 dark:text-slate-400">Routes will be implemented soon.</p>
    </div>
  );

  const renderTable = () => {
    switch (moduleName) {
      case "Shops": return renderShopTable();
      case "Farms": return renderFarmTable();
      case "Vehicles": return renderVehicleTable();
      case "Employees": return renderEmployeeTable();
      case "Banks": return renderBankTable();
      case "Bird Types": return renderBirdTypeTable();
      case "Routes": return renderRouteTable();
      default: return <div className="py-24 text-center text-slate-500 dark:text-slate-400">{t("common.noRecords")}</div>;
    }
  };

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden dark:bg-slate-800 dark:border-slate-700">
      <div className="px-6 py-5 border-b bg-slate-50 flex justify-between items-center dark:bg-slate-700/60 dark:border-slate-700">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{moduleName}</h2>
          <p className="text-slate-500 mt-1 dark:text-slate-400">
            {t("common.showing")} {data.length} {t("common.records")}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">{renderTable()}</div>

      {moduleName !== "Routes" && (
        <div className="border-t bg-slate-50 px-6 py-4 flex justify-between items-center dark:bg-slate-700/60 dark:border-slate-700">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {t("common.page")} {page} {t("common.of")} {totalPages}
          </span>
          <div className="flex gap-3">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="px-4 py-2 border rounded-lg disabled:opacity-40 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
            >
              {t("common.previous")}
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
              className="px-4 py-2 border rounded-lg disabled:opacity-40 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
            >
              {t("common.next")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MasterDataTable;
