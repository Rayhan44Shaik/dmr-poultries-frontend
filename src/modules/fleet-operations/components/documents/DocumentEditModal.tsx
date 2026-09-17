import { memo, useMemo, useState } from "react";
import AppShellModal from "../../../../ui/AppShellModal";
import { ViewLanguageToggle } from "../../../../ui/ViewLanguageToggle";
import { makeT, useI18n, type Language } from "../../../../i18n";
import { uiActionIconMotionClass } from "../../../../shared/ui/uiTokens";
import { formatVehicleNumber } from "../../../../utils/format";
import { toBusinessDate } from "../../../../utils/businessDate";
import type { LucideIcon } from "lucide-react";
import {
  X,
  Save,
  Shield,
  Dumbbell,
  FileCheck,
  Car,
  FileText,
  Upload,
  Eye,
  Trash2,
  Undo2,
  CheckCircle2,
  Download,
} from "lucide-react";
import { DatePicker } from "../../../../components/common/DatePicker";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import permitApi from "../../services/permitApi";

/** Minimal view of a permit document as rendered by the matrix / modal. */
interface PermitDocView {
  expiryDate?: string;
  documentNumber?: string;
  hasDocument?: boolean;
  fileName?: string | null;
  mimeType?: string | null;
  validFrom?: string | null;
  remarks?: string | null;
}

interface DocumentEditModalProps {
  vehicle: { id: string | number; vehicleNumber: string };
  docMap: Record<string, PermitDocView | undefined>;
  docTypes?: string[];
  onClose: () => void;
  onSave: (
    vehicleId: string | number,
    updates: Record<
      string,
      {
        expiryDate?: string;
        documentNumber?: string;
        validFrom?: string;
        remarks?: string;
      }
    >,
    files?: Record<string, File>,
    removes?: Record<string, boolean>,
  ) => Promise<void>;
}

interface DocStyleConfig {
  icon: LucideIcon;
  bg: string;
  border: string;
  text: string;
}

const docConfig: Record<string, DocStyleConfig> = {
  rc: {
    icon: FileText,
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-700",
  },
  insurance: {
    icon: Shield,
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-700",
  },
  fitness: {
    icon: Dumbbell,
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    text: "text-emerald-700",
  },
  permit: {
    icon: FileCheck,
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
  },
  puc: {
    icon: Car,
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
  },
};

const fallbackConfig = {
  icon: FileText,
  bg: "bg-slate-50",
  border: "border-slate-200",
  text: "text-slate-700",
};

/* Scan actions are small icon tiles (same 8×8 tile as the table edit
 * button): attach = label button, view / download / remove = glyph only. */
const scanTileClass =
  "group inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all hover:-translate-y-0.5 hover:shadow-sm active:scale-95 focus-visible:outline-none focus-visible:ring-2";
const scanViewClass = `${scanTileClass} border-blue-100 bg-blue-50/70 text-blue-600 hover:bg-blue-100 focus-visible:ring-blue-300`;
const scanDownloadClass = `${scanTileClass} border-emerald-100 bg-emerald-50/70 text-emerald-600 hover:bg-emerald-100 focus-visible:ring-emerald-300`;
const scanRemoveClass = `${scanTileClass} border-red-100 bg-red-50/70 text-red-600 hover:bg-red-100 focus-visible:ring-red-300`;
const scanAttachClass =
  "inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-600 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 whitespace-nowrap";
/** Selected-file chip and the "will be removed" confirm share one shell. */
const scanChipClass =
  "inline-flex h-8 min-w-0 items-center gap-2 rounded-lg border px-2.5 text-[12px] font-medium";
const fieldLabelClass =
  "text-[11px] font-bold uppercase tracking-wider text-slate-500";
const fieldInputClass =
  "w-full h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-[13px] text-slate-800 transition-all focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

const getExpiry = (doc: PermitDocView | undefined): string | undefined => {
  if (doc && typeof doc === "object") {
    return doc.expiryDate;
  }
  return undefined;
};

const normalizeDate = (input: string | Date | null | undefined): string => {
  if (!input) return "";
  if (typeof input === "string") {
    const date = new Date(input);
    if (!isNaN(date.getTime())) return date.toISOString().split("T")[0];
    const parts = input.split("/");
    if (parts.length === 3) {
      const d = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
      if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
    }
    return "";
  }
  if (input instanceof Date) {
    if (!isNaN(input.getTime())) return input.toISOString().split("T")[0];
  }
  return "";
};

const DocumentEditModal = ({
  vehicle,
  docMap,
  docTypes,
  onClose,
  onSave,
}: DocumentEditModalProps) => {
  const { showNotification } = useSafeNotification();
  const { language: appLanguage } = useI18n();
  // Popup-only EN ⇄ తెలుగు, like the Trip List view — the app language stays.
  const [popupLang, setPopupLang] = useState<Language>(appLanguage);
  const t = useMemo(() => makeT(popupLang), [popupLang]);
  const togglePopupLang = () =>
    setPopupLang((prev) => (prev === "en" ? "te" : "en"));

  const documentTypes =
    docTypes && docTypes.length > 0 ? docTypes : Object.keys(docMap);

  const initialDates: Record<string, string> = {};
  const initialValidFrom: Record<string, string> = {};
  const initialNumbers: Record<string, string> = {};
  const initialRemarks: Record<string, string> = {};
  documentTypes.forEach((type) => {
    const doc = docMap[type];
    const expiry = getExpiry(doc);
    if (expiry) {
      const normalized = normalizeDate(expiry);
      if (normalized) initialDates[type] = normalized;
    }
    if (doc?.validFrom) initialValidFrom[type] = normalizeDate(doc.validFrom);
    if (doc?.documentNumber) initialNumbers[type] = String(doc.documentNumber);
    if (doc?.remarks) initialRemarks[type] = String(doc.remarks);
  });

  const [editedDates, setEditedDates] = useState<Record<string, string>>(
    () => ({ ...initialDates }),
  );
  const [editedValidFrom, setEditedValidFrom] = useState<
    Record<string, string>
  >(() => ({ ...initialValidFrom }));
  const [editedNumbers, setEditedNumbers] = useState<Record<string, string>>(
    () => ({ ...initialNumbers }),
  );
  const [editedRemarks, setEditedRemarks] = useState<Record<string, string>>(
    () => ({ ...initialRemarks }),
  );
  const [selectedFiles, setSelectedFiles] = useState<
    Record<string, File | null>
  >({});
  const [removeFlags, setRemoveFlags] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleDateChange = (type: string, value: string | Date | null) => {
    const normalized = normalizeDate(value);
    setEditedDates((prev) => ({ ...prev, [type]: normalized }));
    setErrors((prev) => ({ ...prev, [type]: "" }));
  };

  const handleNumberChange = (type: string, value: string) => {
    setEditedNumbers((prev) => ({ ...prev, [type]: value }));
    setErrors((prev) => ({ ...prev, [type]: "" }));
  };

  const handleFileChange = (type: string, file: File | null) => {
    if (file) {
      const supported =
        ["image/png", "image/jpeg", "application/pdf"].includes(file.type) ||
        /\.(png|jpe?g|pdf)$/i.test(file.name);
      if (!supported) {
        setErrors((prev) => ({
          ...prev,
          [type]: t("fleet.doc_edit.only_supported"),
        }));
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        setErrors((prev) => ({
          ...prev,
          [type]: t("fleet.doc_edit.file_too_large"),
        }));
        return;
      }
    }
    setSelectedFiles((prev) => ({ ...prev, [type]: file }));
    if (file) setRemoveFlags((prev) => ({ ...prev, [type]: false }));
    setErrors((prev) => ({ ...prev, [type]: "" }));
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    const todayStr = toBusinessDate(new Date());

    const updates: Record<
      string,
      {
        expiryDate?: string;
        documentNumber?: string;
        validFrom?: string;
        remarks?: string;
      }
    > = {};
    const files: Record<string, File> = {};
    const removes: Record<string, boolean> = {};

    documentTypes.forEach((type) => {
      const doc = docMap[type];
      const newDate = editedDates[type];
      const newNumber = editedNumbers[type];
      const newValidFrom = editedValidFrom[type] || "";
      const newRemarks = editedRemarks[type] || "";
      const oldDate = initialDates[type];
      const oldValidFrom = initialValidFrom[type] || "";
      const oldRemarks = initialRemarks[type] || "";
      const oldNumber = doc?.documentNumber ?? "";
      const hasFile = Boolean(selectedFiles[type]);
      const removing = Boolean(removeFlags[type]);

      if (newDate && newDate !== oldDate && newDate < todayStr) {
        newErrors[type] = t("fleet.doc_edit.date_past");
        return;
      }

      const dateChanged = Boolean(newDate && newDate !== oldDate);
      const numberChanged =
        newNumber != null &&
        String(newNumber).trim() !== String(oldNumber ?? "");
      const validFromChanged = newValidFrom !== oldValidFrom;
      const remarksChanged = newRemarks.trim() !== oldRemarks.trim();

      if (newValidFrom && newDate && newValidFrom > newDate) {
        newErrors[type] = t("fleet.doc_edit.valid_from_before_expiry");
        return;
      }

      if (
        !dateChanged &&
        !numberChanged &&
        !validFromChanged &&
        !remarksChanged &&
        !hasFile &&
        !removing
      )
        return;

      if (!newDate && !oldDate) {
        newErrors[type] = t("fleet.doc_edit.expiry_required");
        return;
      }

      const entry: {
        expiryDate?: string;
        documentNumber?: string;
        validFrom?: string;
        remarks?: string;
      } = {};
      if (newDate || oldDate) entry.expiryDate = newDate || oldDate;
      if (newNumber != null) entry.documentNumber = String(newNumber).trim();
      if (validFromChanged) entry.validFrom = newValidFrom;
      if (remarksChanged) entry.remarks = newRemarks.trim();
      updates[type] = entry;
      if (hasFile) files[type] = selectedFiles[type] as File;
      if (removing && !hasFile) removes[type] = true;
    });

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      showNotification(t("fleet.doc_edit.fix_errors"), "error");
      return;
    }
    if (Object.keys(updates).length === 0) {
      showNotification(t("fleet.doc_edit.no_changes"), "info");
      return;
    }

    try {
      await onSave(vehicle.id, updates, files, removes);
    } catch {
      showNotification(t("fleet.documents.update_failed"), "error");
    }
  };

  const getConfig = (type: string) => {
    const key = type.toLowerCase();
    return docConfig[key] || fallbackConfig;
  };

  const vehicleNo = formatVehicleNumber(vehicle.vehicleNumber);

  return (
    <AppShellModal
      open
      onClose={onClose}
      panelClassName="bg-white"
      ariaLabelledBy="doc-edit-title"
    >
      <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white">
        {/* Header — identical anatomy to the Trip List view */}
        <div className="shrink-0 rounded-t-2xl border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/80">
          <div className="flex flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-400 text-white shadow-lg shadow-emerald-400/20">
                <FileText className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h2
                  id="doc-edit-title"
                  className="truncate text-lg font-bold tracking-tight text-slate-800 md:text-xl"
                >
                  {t("fleet.doc_edit.title")}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50/80 px-2.5 py-0.5 text-[11px] font-bold tabular-nums tracking-wide text-emerald-700">
                    <Car size={12} />
                    {vehicleNo}
                  </span>
                  <span className="text-xs font-medium text-slate-400">
                    {t("fleet.doc_edit.vehicle_label", { vehicle: vehicleNo })}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2">
              <ViewLanguageToggle
                language={popupLang}
                onToggle={togglePopupLang}
                tone="emerald"
                labelMode="target"
                ariaLabel={t("fleet.maintenance_view.popup_language_toggle")}
              />
              <button
                type="button"
                onClick={onClose}
                className="group relative inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-all hover:-translate-y-0.5 hover:border-red-100 hover:bg-red-50 hover:text-red-500 active:scale-95"
                aria-label={t("common.close")}
              >
                <span
                  className={`inline-flex ${uiActionIconMotionClass.close}`}
                >
                  <X size={16} />
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Body: 2-Column Grid — no own scroll box, so the calendar popup is
            never clipped. The overlay above scrolls the whole modal instead. */}
        <div className="flex-1 overflow-y-auto bg-slate-50/60 px-4 py-5 md:px-8 md:py-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {documentTypes.map((type, cardIndex) => {
              const doc = docMap[type];
              const expiry = getExpiry(doc);
              const currentDate = editedDates[type] || "";
              const currentNumber = editedNumbers[type] || "";
              const error = errors[type];
              const hasExisting = !!expiry;
              const hasScan = Boolean(doc?.hasDocument && doc?.fileName);
              const config = getConfig(type);
              const Icon = config.icon;
              const isRemoving = Boolean(removeFlags[type]);
              const selectedFileName = selectedFiles[type]?.name;

              return (
                <div
                  key={type}
                  className="relative flex flex-col rounded-xl border border-slate-200/80 bg-white shadow-sm transition-shadow hover:shadow-md focus-within:z-50 motion-safe:animate-[var(--animate-fade-in-up)]"
                  style={{ animationDelay: `${cardIndex * 40}ms` }}
                >
                  {/* Colored Header specific to document type */}
                  {/* FIX: Added rounded-t-xl to keep corners clean without overflow-hidden */}
                  <div
                    className={`flex items-center gap-2.5 rounded-t-xl border-b px-4 py-2.5 ${config.bg} ${config.border}`}
                  >
                    <div
                      className={`p-1.5 rounded-lg bg-white shadow-sm border ${config.border}`}
                    >
                      <Icon className={`w-4 h-4 ${config.text}`} />
                    </div>
                    <h3
                      className={`text-[12px] font-bold uppercase tracking-wider ${config.text}`}
                    >
                      {t(`fleet.doc_label.${type}`)}
                    </h3>
                    {hasScan && (
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                        <CheckCircle2 size={10} /> {t("fleet.doc_edit.scan")}
                      </span>
                    )}
                  </div>

                  {/* Body of Card */}
                  <div className="flex flex-1 flex-col gap-3.5 p-4">
                    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                      {/* Document Number */}
                      <div className="flex flex-col gap-1.5">
                        <label className={fieldLabelClass}>
                          {t("fleet.doc_edit.document_no")}
                        </label>
                        <input
                          type="text"
                          value={currentNumber}
                          onChange={(e) =>
                            handleNumberChange(type, e.target.value)
                          }
                          placeholder="e.g. 123456789"
                          className={`${fieldInputClass} font-medium tabular-nums`}
                        />
                      </div>

                      {/* Expiry Date */}
                      <div className="flex flex-col gap-1.5">
                        <label className={fieldLabelClass}>
                          {t("fleet.doc_edit.expiry_date")}
                        </label>
                        <div className="relative w-full z-10">
                          <DatePicker
                            value={currentDate}
                            onChange={(val) => handleDateChange(type, val)}
                            placeholder={
                              hasExisting
                                ? t("fleet.doc_edit.update_date")
                                : t("fleet.doc_edit.select_date")
                            }
                            error={error}
                            language={popupLang}
                            className="w-full text-[13px]"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className={fieldLabelClass}>
                          {t("fleet.doc_edit.valid_from")}
                        </label>
                        <DatePicker
                          value={editedValidFrom[type] || ""}
                          onChange={(val) =>
                            setEditedValidFrom((prev) => ({
                              ...prev,
                              [type]: normalizeDate(val),
                            }))
                          }
                          placeholder={t("fleet.doc_edit.valid_from")}
                          language={popupLang}
                          className="w-full text-[13px]"
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className={fieldLabelClass}>
                          {t("fleet.doc_edit.remarks")}
                        </label>
                        <input
                          type="text"
                          value={editedRemarks[type] || ""}
                          onChange={(e) =>
                            setEditedRemarks((prev) => ({
                              ...prev,
                              [type]: e.target.value,
                            }))
                          }
                          placeholder={t("fleet.doc_edit.remarks_placeholder")}
                          className={fieldInputClass}
                        />
                      </div>
                    </div>

                    {/* Warning Messages */}
                    {!hasExisting && !currentDate && !error && (
                      <div className="text-xs font-medium text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200/60 flex items-center gap-2 mt-auto">
                        <Car className="w-3.5 h-3.5 shrink-0" />
                        {t("fleet.doc_edit.no_document")}
                      </div>
                    )}
                    {error && (
                      <div className="text-xs font-medium text-rose-600 bg-rose-50 px-3 py-2 rounded-lg border border-rose-200/60 mt-auto">
                        {error}
                      </div>
                    )}

                    {/* Scan — attach / view / download / remove on one level row.
                        Label on the left, every control in a single right-aligned
                        group, all sharing one height so the row never ragged. */}
                    <div className="mt-auto border-t border-slate-100 pt-3">
                      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                        <span className={`shrink-0 ${fieldLabelClass}`}>
                          {t("fleet.doc_edit.scan")}
                        </span>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {/* Newly selected file */}
                          {selectedFileName ? (
                            <span
                              className={`${scanChipClass} max-w-full border-emerald-200 bg-emerald-50 text-emerald-700 sm:max-w-[280px]`}
                            >
                              <CheckCircle2
                                className="h-4 w-4 shrink-0"
                                aria-hidden="true"
                              />
                              <span className="truncate">
                                {selectedFileName}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleFileChange(type, null)}
                                aria-label={t("fleet.doc_edit.undo_upload")}
                                className="-mr-1 shrink-0 rounded p-1 text-emerald-600 transition-colors hover:bg-emerald-100 hover:text-emerald-800"
                              >
                                <Undo2
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              </button>
                            </span>
                          ) : (
                            <label className={scanAttachClass}>
                              <Upload
                                className="h-3.5 w-3.5 text-slate-400"
                                aria-hidden="true"
                              />
                              {hasScan
                                ? t("fleet.doc_edit.replace_scan")
                                : t("fleet.doc_edit.attach_scan")}
                              <input
                                type="file"
                                accept=".png,.jpg,.jpeg,.pdf"
                                className="hidden"
                                onChange={(e) =>
                                  handleFileChange(
                                    type,
                                    e.target.files?.[0] ?? null,
                                  )
                                }
                              />
                            </label>
                          )}

                          {/* Existing scan actions */}
                          {hasScan && !selectedFileName && (
                            <a
                              href={permitApi.documentUrl(vehicle.id, type)}
                              target="_blank"
                              rel="noreferrer"
                              className={scanViewClass}
                              aria-label={t("common.view")}
                            >
                              <span
                                className={`inline-flex ${uiActionIconMotionClass.view}`}
                              >
                                <Eye
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              </span>
                            </a>
                          )}

                          {hasScan && !selectedFileName && (
                            <button
                              type="button"
                              onClick={() =>
                                permitApi.downloadDocument(
                                  vehicle.id,
                                  type,
                                  doc?.fileName,
                                )
                              }
                              className={scanDownloadClass}
                              aria-label={t("fleet.doc_edit.download_scan")}
                            >
                              <span
                                className={`inline-flex ${uiActionIconMotionClass.pdf}`}
                              >
                                <Download
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              </span>
                            </button>
                          )}

                          {hasScan && !isRemoving && !selectedFileName && (
                            <button
                              type="button"
                              onClick={() => {
                                setRemoveFlags((prev) => ({
                                  ...prev,
                                  [type]: true,
                                }));
                                setSelectedFiles((prev) => ({
                                  ...prev,
                                  [type]: null,
                                }));
                              }}
                              className={scanRemoveClass}
                              aria-label={t("common.remove")}
                            >
                              <span
                                className={`inline-flex ${uiActionIconMotionClass.delete}`}
                              >
                                <Trash2
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                              </span>
                            </button>
                          )}

                          {isRemoving && !selectedFileName && (
                            <span
                              className={`${scanChipClass} border-rose-200 bg-rose-50 text-rose-700`}
                            >
                              {t("fleet.doc_edit.scan_will_be_removed")}
                              <button
                                type="button"
                                onClick={() =>
                                  setRemoveFlags((prev) => ({
                                    ...prev,
                                    [type]: false,
                                  }))
                                }
                                className="shrink-0 font-bold underline decoration-rose-300 underline-offset-2 transition-colors hover:text-rose-900"
                              >
                                {t("fleet.doc_edit.undo")}
                              </button>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer — Trip List view footer */}
        <div className="flex shrink-0 items-center justify-end gap-3 rounded-b-2xl border-t border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 px-6 py-4 md:px-8">
          <button
            type="button"
            onClick={onClose}
            className="group relative inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-5 py-2.5 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-200 active:scale-95"
          >
            <span className={`inline-flex ${uiActionIconMotionClass.close}`}>
              <X size={15} />
            </span>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="group relative inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-6 py-2.5 text-xs font-semibold text-white shadow-sm shadow-emerald-600/20 transition-all hover:-translate-y-0.5 hover:bg-emerald-700 active:scale-95"
          >
            <span className="inline-flex transition-transform group-hover:scale-110">
              <Save size={15} />
            </span>
            {t("fleet.doc_edit.save_changes")}
          </button>
        </div>
      </div>
    </AppShellModal>
  );
};

export default memo(DocumentEditModal);
