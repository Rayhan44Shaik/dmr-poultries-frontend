import MasterDropdown from "./MasterDropdown";
import { ExcelButton, PdfButton } from "../../../ui";
import {
  uiCardClass,
  uiFilterFieldClass,
  uiPaginationSummaryClass,
} from "../../../shared/ui/uiTokens";

type MasterToolbarProps = {
  moduleName: string;
  status: string;
  totalRecords: number;
  onModuleChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onExcel: () => void;
  onPdf: () => void;
};

/**
 * Master filter + export toolbar.
 *
 * Standardised on the global UI kit:
 *   • PDF and Excel now carry the canonical semantic actions — FileText in a
 *     rose outline and FileSpreadsheet in an emerald outline. They were neutral
 *     slate here, which made them indistinguishable from a secondary button and
 *     inconsistent with the same two actions in Operations and Reports.
 *   • The panel uses the global card token (14px radius, hairline border,
 *     restrained `shadow-card`) instead of an ad-hoc `shadow-sm`.
 *   • Filters sit in a 40px row so the dropdowns and the export buttons share
 *     one baseline and one control height.
 */
function MasterToolbar({
  moduleName,
  status,
  totalRecords,
  onModuleChange,
  onStatusChange,
  onExcel,
  onPdf,
}: MasterToolbarProps) {
  return (
    <div className={`${uiCardClass} flex flex-wrap items-end justify-between gap-4 p-4`}>
      <div className="flex flex-wrap items-end gap-3">
        <MasterDropdown
          label="Select Module"
          value={moduleName}
          onChange={onModuleChange}
          options={[
            "Shops",
            "Farms",
            "Vehicles",
            "Employees",
            "Banks",
            "Bird Types",
            "Routes",
          ]}
          className={uiFilterFieldClass}
        />
        <MasterDropdown
          label="Status"
          value={status}
          onChange={onStatusChange}
          options={["All", "Active", "Inactive"]}
          className={uiFilterFieldClass}
        />
        <p className={`${uiPaginationSummaryClass} mr-0 pb-2.5`}>
          Showing{" "}
          <span className="font-semibold tabular-nums text-emerald-700">
            {totalRecords}
          </span>{" "}
          records
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ExcelButton onClick={onExcel}>Excel</ExcelButton>
        <PdfButton onClick={onPdf}>PDF</PdfButton>
      </div>
    </div>
  );
}

export default MasterToolbar;
