import { BarChart3, Building2, CalendarDays, Ruler } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "../../../../i18n";
import {
  sizeCategoryHeaders,
  sizeColumnLabel,
  type MarketNumeric,
  type RateEntryMarketRateMasterDto,
} from "../utils/rateEntryMarketMaster";

type Props = {
  master: RateEntryMarketRateMasterDto | null | undefined;
  tripDate?: string;
  loadError?: string | null;
  loading?: boolean;
};

type Tone = "emerald" | "amber" | "sky";

const toneClass: Record<
  Tone,
  {
    icon: string;
    title: string;
    tripRow: string;
    tripBadge: string;
  }
> = {
  emerald: {
    icon: "bg-emerald-100 text-emerald-700",
    title: "text-emerald-800",
    tripRow: "bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-200",
    tripBadge: "border-emerald-200 bg-emerald-100 text-emerald-700",
  },
  amber: {
    icon: "bg-amber-100 text-amber-700",
    title: "text-amber-800",
    tripRow: "bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200",
    tripBadge: "border-amber-200 bg-amber-100 text-amber-800",
  },
  sky: {
    icon: "bg-sky-100 text-sky-700",
    title: "text-sky-800",
    tripRow: "bg-sky-50 text-sky-900 ring-1 ring-inset ring-sky-200",
    tripBadge: "border-sky-200 bg-sky-100 text-sky-700",
  },
};

function formatDdMm(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}-${m[2]}`;
}

function formatWindowDate(iso: string | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function numericCell(entered: boolean, value: MarketNumeric, key?: string) {
  const missing = !entered || value == null;
  return (
    <td
      key={key}
      className={`px-2 py-1.5 text-center text-[11px] ${
        missing ? "text-slate-400" : "font-semibold text-slate-800 tabular-nums"
      }`}
    >
      {missing ? "—" : Number(value).toFixed(2)}
    </td>
  );
}

function MasterCard({
  title,
  icon,
  tone,
  children,
}: {
  title: string;
  icon: ReactNode;
  tone: Tone;
  children: ReactNode;
}) {
  const classes = toneClass[tone];
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-xl ${classes.icon}`}>
          {icon}
        </span>
        <p className={`text-xs font-bold uppercase tracking-wide ${classes.title}`}>{title}</p>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

export default function RateEntryMarketMasterTables({
  master,
  tripDate,
  loadError,
  loading,
}: Props) {
  const { t } = useI18n();

  if (loading) {
    return (
      <div className="px-5 py-2.5 border-b bg-slate-50 text-xs text-slate-600">
        {t("ops.rate.market.loading")}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="px-5 py-2.5 border-b border-red-200 bg-red-50 text-xs font-medium text-red-700">
        {t("ops.rate.market.error")} {loadError}
      </div>
    );
  }

  if (!master) {
    return (
      <div className="px-5 py-2.5 border-b bg-slate-50 text-xs text-slate-500">
        {t("ops.rate.market.unavailable")}
      </div>
    );
  }

  const sizeKeys = sizeCategoryHeaders(master);
  const tripIso = tripDate || master.tripDate;
  const rowClass = (date: string, tone: Tone) =>
    date === tripIso ? toneClass[tone].tripRow : "bg-white hover:bg-slate-50/70";
  const tripBadge = (tone: Tone) => toneClass[tone].tripBadge;

  const dateCell = (date: string, tone: Tone) => {
    const isTripDay = date === tripIso;
    return (
      <td className="px-2 py-1.5 text-left text-[11px] font-bold text-slate-700">
        <div className="flex min-w-[74px] items-center gap-1.5">
          <span>{formatDdMm(date)}</span>
          {isTripDay && (
            <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${tripBadge(tone)}`}>
              {t("ops.rate.market.trip_day")}
            </span>
          )}
        </div>
      </td>
    );
  };

  return (
    <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-emerald-50/40 px-5 py-3">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <CalendarDays size={17} />
          </span>
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">{t("ops.rate.market.title")}</h3>
            <p className="text-[11px] font-medium text-slate-500">
              {t("ops.rate.market.window")}: {formatWindowDate(master.fromDate)} – {formatWindowDate(master.toDate)}
            </p>
          </div>
        </div>
        <span className="inline-flex w-fit items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
          {t("ops.rate.market.trip_day_highlighted")}: {formatWindowDate(tripIso)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <MasterCard title={t("ops.rate.market.additional_title")} tone="emerald" icon={<BarChart3 size={15} />}>
          <table className="w-full min-w-[260px] border-collapse text-[11px]">
            <thead>
              <tr className="bg-white text-slate-500">
                <th className="px-2 py-1.5 text-left font-semibold">{t("ops.rate.market.date")}</th>
                <th className="px-2 py-1.5 text-center font-semibold">{t("ops.rate.market.col.vij")}</th>
                <th className="px-2 py-1.5 text-center font-semibold">{t("ops.rate.market.col.gun")}</th>
                <th className="px-2 py-1.5 text-center font-semibold">{t("ops.rate.market.col.rp")}</th>
              </tr>
            </thead>
            <tbody>
              {master.additionalMetrics.map((row) => (
                <tr key={row.date} className={`border-t border-slate-100 ${rowClass(row.date, "emerald")}`}>
                  {dateCell(row.date, "emerald")}
                  {numericCell(row.entered, row.vij)}
                  {numericCell(row.entered, row.gun)}
                  {numericCell(row.entered, row.rp)}
                </tr>
              ))}
            </tbody>
          </table>
        </MasterCard>

        <MasterCard title={t("ops.rate.market.company_title")} tone="amber" icon={<Building2 size={15} />}>
          <table className="w-full min-w-[440px] border-collapse text-[11px]">
            <thead>
              <tr className="bg-white text-slate-500">
                <th className="px-2 py-1.5 text-left font-semibold">{t("ops.rate.market.date")}</th>
                <th className="px-2 py-1.5 text-center font-semibold whitespace-nowrap">{t("ops.rate.market.col.sneha")}</th>
                <th className="px-2 py-1.5 text-center font-semibold whitespace-nowrap">{t("ops.rate.market.col.ven_rate")}</th>
                <th className="px-2 py-1.5 text-center font-semibold whitespace-nowrap">{t("ops.rate.market.col.ven_vij")}</th>
                <th className="px-2 py-1.5 text-center font-semibold whitespace-nowrap">{t("ops.rate.market.col.ven_gun")}</th>
                <th className="px-2 py-1.5 text-center font-semibold whitespace-nowrap">{t("ops.rate.market.col.asso_vij")}</th>
              </tr>
            </thead>
            <tbody>
              {master.companyRates.map((row) => (
                <tr key={row.date} className={`border-t border-slate-100 ${rowClass(row.date, "amber")}`}>
                  {dateCell(row.date, "amber")}
                  {numericCell(row.entered, row.sneha)}
                  {numericCell(row.entered, row.vencobRate)}
                  {numericCell(row.entered, row.vencobVii)}
                  {numericCell(row.entered, row.vencobGun)}
                  {numericCell(row.entered, row.associationVii)}
                </tr>
              ))}
            </tbody>
          </table>
        </MasterCard>

        <MasterCard title={t("ops.rate.market.size_title")} tone="sky" icon={<Ruler size={15} />}>
          <table className="w-full min-w-[320px] border-collapse text-[11px]">
            <thead>
              <tr className="bg-white text-slate-500">
                <th className="px-2 py-1.5 text-left font-semibold">{t("ops.rate.market.date")}</th>
                {sizeKeys.map((key) => (
                  <th key={key} className="px-2 py-1.5 text-center font-semibold">
                    {sizeColumnLabel(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {master.sizeCategoryBreakdown.map((row) => (
                <tr key={row.date} className={`border-t border-slate-100 ${rowClass(row.date, "sky")}`}>
                  {dateCell(row.date, "sky")}
                  {sizeKeys.map((key) =>
                    numericCell(row.entered, row.columns?.[key] ?? null, key)
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </MasterCard>
      </div>
    </div>
  );
}
