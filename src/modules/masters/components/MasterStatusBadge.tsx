import { translateStatus, useI18n } from "../../../i18n";

export default function MasterStatusBadge({
  status,
}: {
  status: "Active" | "Inactive";
}) {
  const { t } = useI18n();
  const active = status === "Active";
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        active
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : "bg-slate-100 text-slate-500 ring-slate-200"
      }`}
    >
      <span
        aria-hidden="true"
        className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`}
      />
      {translateStatus(t, status)}
    </span>
  );
}
