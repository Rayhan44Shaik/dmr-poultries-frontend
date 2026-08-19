// src/modules/operations/vehicle-trips/components/TripViewModal.tsx
// Read-only Trip View. Never reuses editable Step wizard controls.
// For completed trips it shows the Trip Summary + Shop Delivery cards
// (with per-shop email status and "Send All Mail"). Incomplete trips keep
// the existing read-only step presentation.

import React, { useState, useCallback } from "react";
import {
  FileText,
  Download,
  Mail,
  ShieldCheck,
  Send,
  Loader2,
  Route,
  Receipt,
  Clock,
  UserCheck,
  Box,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Trip, ShopDelivery } from "../types/trip";
import {
  getNextIncompleteTripStep,
  getTripWizardCompletedMask,
  isTripWizardComplete,
  TRIP_STEP_LABELS,
} from "../../../../shared/trip";
import { generateShopPDF } from "../utils/generateShopPDF";
import { useTripDeliveryEmails } from "../hooks/useTripDeliveryEmails";
import TripViewShopCards from "./TripViewShopCards";

// --- Read-only step presentation (incomplete trips only) ---
import TripWizardStepper from "./TripWizardStepper";
import StepStart from "./StepStart";
import StepPickup from "./StepPickup";
import StepDeliveries from "./StepDeliveries";
import StepEnd from "./Step_5/StepEnd";
import TripFinalKPI from "./TripFinalKPI";

interface Props {
  open: boolean;
  trip: Trip | null;
  onClose: () => void;
  shops: any[];
  birdTypes: any[];
}

function Step2View({ trip }: { trip: Trip }) {
  const gpsCaptured =
    trip.farmGpsLat != null &&
    trip.farmGpsLon != null &&
    Number.isFinite(Number(trip.farmGpsLat)) &&
    Number.isFinite(Number(trip.farmGpsLon)) &&
    !(Number(trip.farmGpsLat) === 0 && Number(trip.farmGpsLon) === 0);
  const rows: Array<[string, string]> = [
    ["Trip Number", trip.tripNo || "Not entered"],
    ["Step 2 status", trip.farmStepSubmitted ? "Submitted" : "Not submitted"],
    ["Farm Name", trip.sourceFarm || "Not entered"],
    ["Farm Address", trip.farmAddress?.trim() ? trip.farmAddress : "Not entered"],
    ["Farm Meter", trip.destMeter ? `${trip.destMeter} KM` : "Not entered"],
    ["Step 2 Reached/Farm Time", trip.reachedTime || "Not entered"],
    ["Tolls", trip.pickupTolls == null ? "Not entered" : String(trip.pickupTolls)],
    ["Average Bird Weight", trip.avgBirdWeight ? `${trip.avgBirdWeight} kg` : "Not entered"],
    ["GPS Latitude", gpsCaptured ? String(trip.farmGpsLat) : "Not entered"],
    ["GPS Longitude", gpsCaptured ? String(trip.farmGpsLon) : "Not entered"],
    ["GPS Accuracy", gpsCaptured && trip.farmGpsAccuracy != null ? String(trip.farmGpsAccuracy) : "Not entered"],
    ["GPS Captured Time", gpsCaptured && trip.farmGpsTime ? String(trip.farmGpsTime) : "Not entered"],
    ["Remarks", trip.remarks?.trim() ? trip.remarks : "Not entered"],
  ];
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
      <h3 className="text-sm font-bold text-slate-800">Step 2 — Farm Loading</h3>
      <p className="text-xs font-semibold text-slate-600">{gpsCaptured ? "GPS captured" : "GPS: Not captured"}</p>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="border border-slate-100 rounded-xl p-3">
            <dt className="text-[10px] uppercase font-semibold text-slate-400">{label}</dt>
            <dd className="text-xs font-semibold text-slate-800 mt-0.5">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/** View-only read-only detail grid. */
function ViewSection({
  icon,
  title,
  children,
}: {
  icon?: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm">
      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border border-slate-100 rounded-xl p-3 bg-slate-50/40">
      <dt className="text-[10px] uppercase font-semibold text-slate-400">{label}</dt>
      <dd className="text-xs font-semibold text-slate-800 mt-0.5 break-words">{value || "—"}</dd>
    </div>
  );
}

/** Read-only Trip Summary used for completed trips. */
function TripViewSummary({ trip }: { trip: Trip }) {
  const totalKm =
    trip.totalKm != null && Number.isFinite(Number(trip.totalKm))
      ? Number(trip.totalKm)
      : Number(trip.closingMeter || 0) - Number(trip.openingMeter || 0);

  const pickupBoxes = Array.isArray(trip.boxDetails) ? trip.boxDetails : [];
  const submittedDiesel = Array.isArray(trip.dieselEntries)
    ? trip.dieselEntries.filter((e) => e.submitted !== false)
    : [];

  const expensePairs: Array<[string, number]> = [
    ["Meals", Number(trip.meals || 0)],
    ["Loading", Number(trip.loading || 0)],
    ["Meals / Tiffin", Number(trip.mealsTiffin || 0)],
    ["Vehicle Maintenance", Number(trip.vehicleMaintenance || 0)],
    ["Tea", Number(trip.othersRC || 0)],
    ["Driver", Number(trip.others1Amt || 0)],
    ["Supervisor", Number(trip.others2Amt || 0)],
    ["Helper & loader", Number(trip.others3Amt || 0)],
    ["Others", Number(trip.others4Amt || 0)],
    ["Others", Number(trip.others5Amt || 0)],
  ];
  const positiveExpenses = expensePairs.filter(([, amt]) => amt > 0);

  return (
    <div className="space-y-4">
      <ViewSection
        icon={<Route size={15} className="text-emerald-600" />}
        title="Trip Summary"
      >
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <DetailRow label="Trip No" value={trip.tripNo} />
          <DetailRow label="Trip Date" value={trip.tripDate} />
          <DetailRow label="Vehicle" value={trip.vehicleNo} />
          <DetailRow label="Driver" value={trip.driverName} />
          <DetailRow label="Supervisor" value={trip.supervisorName} />
          <DetailRow label="Source Farm" value={trip.sourceFarm} />
          <DetailRow label="Opening KM" value={trip.openingMeter != null ? `${trip.openingMeter} KM` : "Not entered"} />
          <DetailRow label="Closing KM" value={trip.closingMeter != null ? `${trip.closingMeter} KM` : "Not entered"} />
          <DetailRow label="Total KM" value={`${totalKm} KM`} />
          <DetailRow label="Fuel" value={trip.fuel != null ? `${trip.fuel} Ltrs` : "Not entered"} />
          <DetailRow label="Total Expenses" value={trip.expense != null ? `₹ ${trip.expense}` : "Not entered"} />
          <DetailRow
            label="Status"
            value={
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                <ShieldCheck size={11} /> {trip.status}
              </span>
            }
          />
        </dl>
      </ViewSection>

      <ViewSection icon={<Clock size={15} className="text-indigo-600" />} title="Step 1 — Trip Start">
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <DetailRow label="Start Time" value={trip.startTime} />
          <DetailRow label="Advance" value={trip.advanceAmount != null ? `₹ ${trip.advanceAmount.toLocaleString()}` : "Not entered"} />
          <DetailRow label="Helpers" value={trip.helpers?.join(", ")} />
          <DetailRow label="Loaders" value={trip.loaders?.join(", ")} />
        </dl>
      </ViewSection>

      <Step2View trip={trip} />

      <ViewSection icon={<Box size={15} className="text-amber-600" />} title="Step 3 — Pickup Details">
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <DetailRow label="DC Weight" value={trip.dcWeight != null ? `${trip.dcWeight} KG` : "Not entered"} />
          <DetailRow label="Total Birds" value={trip.totalBirds != null ? String(trip.totalBirds) : "Not entered"} />
          <DetailRow label="Boxes" value={trip.boxes != null ? String(trip.boxes) : "Not entered"} />
          <DetailRow label="Avg Weight" value={trip.avgWeight != null ? `${trip.avgWeight} kg` : "Not entered"} />
          <DetailRow label="Pickup Load Time" value={trip.pickupLoadTime || "Not entered"} />
          <DetailRow label="Delivered Weight" value={trip.totalDeliveredWeight != null ? `${trip.totalDeliveredWeight} KG` : "Not entered"} />
          <DetailRow label="Mortality" value={trip.totalMortality != null ? `${trip.totalMortality} birds` : "Not entered"} />
          <DetailRow label="Last Shop" value={trip.lastShop || "Not entered"} />
        </dl>
        {pickupBoxes.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200/70">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/80">
                <tr>
                  {["S.No", "Box", "Birds", "Weight (KG)", "Avg WT"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pickupBoxes.map((b, index) => {
                  const birds = Number(b.birds || 0);
                  const weight = Number(b.weight || 0);
                  const avg =
                    b.avgWeight != null && Number.isFinite(Number(b.avgWeight))
                      ? Number(b.avgWeight)
                      : birds > 0 && weight > 0
                        ? Number((weight / birds).toFixed(3))
                        : null;
                  return (
                    <tr key={b.boxNo} className="hover:bg-slate-50/60">
                      <td className="px-3 py-2 text-slate-500">{index + 1}</td>
                      <td className="px-3 py-2 font-semibold text-slate-800">#{b.boxNo}</td>
                      <td className="px-3 py-2 text-slate-700">{birds}</td>
                      <td className="px-3 py-2 text-slate-700 tabular-nums">{weight.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-700 tabular-nums">{avg == null ? "--" : avg.toFixed(3)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ViewSection>

      <ViewSection icon={<Receipt size={15} className="text-orange-600" />} title="Step 5 — Expenses & Diesel">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">General Expenses</h4>
            {positiveExpenses.length ? (
              <div className="rounded-xl border border-slate-200/70 overflow-hidden">
                <table className="w-full text-xs">
                  <tbody className="divide-y divide-slate-100">
                    {positiveExpenses.map(([label, amt]) => (
                      <tr key={label} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2 text-slate-600">{label}</td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-800 tabular-nums">₹ {amt.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400">No expenses recorded.</p>
            )}
          </div>
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Diesel / Fuel</h4>
            {submittedDiesel.length ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200/70">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50/80">
                    <tr>
                      {["S.No", "Litres", "Rate", "Amount", "Meter", "Bunk"].map((h) => (
                        <th key={h} className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {submittedDiesel.map((e, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2 text-slate-500">{idx + 1}</td>
                        <td className="px-3 py-2 text-slate-700 tabular-nums">{String(e.litres ?? "")}</td>
                        <td className="px-3 py-2 text-slate-700 tabular-nums">{String(e.rate ?? "")}</td>
                        <td className="px-3 py-2 text-slate-700 tabular-nums">₹ {Number(e.amount ?? 0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-slate-700">{String(e.meter ?? "--")}</td>
                        <td className="px-3 py-2 text-slate-700">{String(e.bunkName || "--")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-400">No diesel entries recorded.</p>
            )}
            <p className="text-xs text-slate-500 mt-2">
              Mileage:{" "}
              {trip.mileageKmL != null && Number.isFinite(Number(trip.mileageKmL))
                ? `${Number(trip.mileageKmL).toFixed(2)} km/L`
                : "Not available"}
            </p>
          </div>
        </div>
      </ViewSection>
    </div>
  );
}

function TripViewModal({ open, trip, onClose, shops, birdTypes: _birdTypes }: Props) {
  const [viewStepIndex, setViewStepIndex] = useState(0);

  const noopSubscribeSaveStatus = useCallback((_listener: () => void) => () => {}, []);
  const getIdleSaveStatus = useCallback(() => "idle" as const, []);

  const emailState = useTripDeliveryEmails(trip, shops);

  // ─── Early return – ensures trip is never null after this ─────
  if (!open || !trip) return null;

  const isCompleted = trip.status === "Completed" && isTripWizardComplete(trip);

  // ─── STEP STATE FLAGS (backend submitted flags only) ───
  const isStartCompleted = Boolean(trip.startStepSubmitted);
  const isDeliveryCompleted = Boolean(trip.deliveryStepSubmitted);
  const isEndCompleted = isTripWizardComplete(trip);
  const completedMask = getTripWizardCompletedMask(trip);
  const currentStep = isEndCompleted ? 4 : getNextIncompleteTripStep(trip);

  const downloadShopPDF = async (delivery: ShopDelivery) => {
    await generateShopPDF(
      delivery,
      trip.boxDetails || [],
      trip.tripNo,
      trip.vehicleNo,
      trip.supervisorName,
      undefined,
      trip.tripDate,
      undefined,
      undefined,
      delivery.autoCaptureTime,
      trip.driverName
    );
  };

  // ─── PDF download ──────────────────────────────────────────────
  const downloadPDF = () => {
    const doc = new jsPDF("p", "mm", "a4");
    const margin = 16;
    let y = 20;

    doc.setFontSize(18);
    doc.setTextColor(5, 150, 105);
    doc.text("Trip Details", margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const dateStr = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    doc.text(`Generated on: ${dateStr}`, margin, y);
    y += 6;

    const summaryData = [
      ["Trip No", trip.tripNo, "Vehicle", trip.vehicleNo],
      ["Trip Date", trip.tripDate, "Driver", trip.driverName],
      ["Supervisor", trip.supervisorName, "Source Farm", trip.sourceFarm],
      ["Opening KM", trip.openingMeter == null ? "Not entered" : trip.openingMeter.toString(), "Closing KM", trip.closingMeter.toString()],
      ["Total KM", totalKmForPdf().toString(), "Fuel (Ltrs)", trip.fuel.toString()],
      ["Expense", `₹ ${trip.expense}`, "Status", trip.status],
      ["DC Weight", `${(trip as any).dcWeight || 0} KG`, "Total Birds", `${trip.totalBirds || 0}`],
      ["Farm", trip.sourceFarm || "Not entered", "Farm Meter", trip.destMeter ? String(trip.destMeter) : "Not entered"],
      ["Farm Address", trip.farmAddress?.trim() ? trip.farmAddress : "Not entered", "Avg Bird Weight", trip.avgBirdWeight ? `${trip.avgBirdWeight} kg` : "Not entered"],
      ["Tolls (Farm)", trip.pickupTolls == null ? "Not entered" : String(trip.pickupTolls), "Farm Time", trip.reachedTime || "Not entered"],
      [
        "GPS",
        trip.farmGpsLat != null &&
        trip.farmGpsLon != null &&
        Number.isFinite(Number(trip.farmGpsLat)) &&
        Number.isFinite(Number(trip.farmGpsLon)) &&
        !(Number(trip.farmGpsLat) === 0 && Number(trip.farmGpsLon) === 0)
          ? `${trip.farmGpsLat}, ${trip.farmGpsLon}`
          : "GPS: Not captured",
        "GPS Time",
        trip.farmGpsTime || "Not entered",
      ],
      ...((trip as any).approvedBy ? [["Approved By", (trip as any).approvedBy, "", ""]] : []),
    ];

    autoTable(doc, {
      body: summaryData.map((row) => [row[0], row[1], row[2], row[3]]),
      startY: y,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 30, fontStyle: "bold", textColor: [80, 80, 80] }, 1: { cellWidth: 45 }, 2: { cellWidth: 30, fontStyle: "bold", textColor: [80, 80, 80] }, 3: { cellWidth: 45 } },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text("Remarks:", margin, y);
    y += 5;
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(trip.remarks || "--", margin, y);
    y += 8;

    const pickupBoxes = Array.isArray(trip.boxDetails) ? trip.boxDetails : [];
    if (pickupBoxes.length) {
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text("Step 3 — Pickup Boxes", margin, y);
      y += 4;
      autoTable(doc, {
        head: [["S.No", "Box", "Birds", "Weight (KG)", "Avg WT"]],
        body: pickupBoxes.map((b, index) => {
          const birds = Number(b.birds || 0);
          const weight = Number(b.weight || 0);
          const avg =
            b.avgWeight != null && Number.isFinite(Number(b.avgWeight))
              ? Number(b.avgWeight)
              : birds > 0 && weight > 0
                ? Number((weight / birds).toFixed(3))
                : null;
          return [
            String(index + 1),
            String(b.boxNo),
            String(birds),
            weight.toFixed(2),
            avg == null ? "--" : avg.toFixed(3),
          ];
        }),
        startY: y,
        theme: "striped",
        headStyles: { fillColor: [5, 150, 105], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 2 },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    const tableHeaders = ["S.No", "Shop", "Mode", "Boxes", "Birds", "Weight (KG)", "Mortality", "Remarks"];
    const tableRows = (trip.deliveries || []).map((row, index) => [
      (index + 1).toString(),
      row.shopName || "--",
      row.deliveryMode === "weight" ? "Weight" : "Box",
      Array.isArray(row.selectedBoxIds) && row.selectedBoxIds.length
        ? row.selectedBoxIds.join(", ")
        : row.boxNo != null
          ? String(row.boxNo)
          : "--",
      String(row.birds ?? 0),
      Number(row.weight || 0).toFixed(2),
      `${row.mortality ?? 0}${row.mortKg ? ` / ${Number(row.mortKg).toFixed(2)} kg` : ""}`,
      row.remarks || "--",
    ]);

    autoTable(doc, {
      head: [tableHeaders],
      body: tableRows,
      startY: y,
      theme: "striped",
      headStyles: { fillColor: [5, 150, 105], textColor: 255, fontStyle: "bold", halign: "center" },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: { 0: { halign: "center", cellWidth: 12 }, 1: { halign: "center", cellWidth: 15 }, 2: { halign: "left", cellWidth: 63 }, 3: { halign: "center", cellWidth: 20 }, 4: { halign: "center", cellWidth: 25 }, 5: { halign: "center", cellWidth: 25 } },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    const expenseRows: string[][] = [];
    const expensePairs: Array<[string, number]> = [
      ["Meals", Number(trip.meals || 0)],
      ["Loading", Number(trip.loading || 0)],
      ["Meals / Tiffin", Number(trip.mealsTiffin || 0)],
      ["Vehicle Maintenance", Number(trip.vehicleMaintenance || 0)],
      ["Tea", Number(trip.othersRC || 0)],
      ["Driver", Number(trip.others1Amt || 0)],
      ["Supervisor", Number(trip.others2Amt || 0)],
      ["Helper & loader", Number(trip.others3Amt || 0)],
      ["Others", Number(trip.others4Amt || 0)],
      ["Others", Number(trip.others5Amt || 0)],
    ];
    expensePairs.filter(([, amt]) => amt > 0).forEach(([label, amt]) => {
      expenseRows.push([label, `₹ ${amt.toFixed(2)}`]);
    });
    if (expenseRows.length) {
      doc.setFontSize(12);
      doc.text("Step 5 — General Expenses", margin, y);
      y += 4;
      autoTable(doc, {
        head: [["Category", "Amount"]],
        body: expenseRows,
        startY: y,
        theme: "striped",
        headStyles: { fillColor: [5, 150, 105], textColor: 255 },
        styles: { fontSize: 9, cellPadding: 2 },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    const dieselRows: string[][] = [];
    const submittedDiesel = Array.isArray(trip.dieselEntries)
      ? trip.dieselEntries.filter((e) => e.submitted !== false)
      : [];
    if (submittedDiesel.length) {
      submittedDiesel.forEach((e, idx) => {
        const lat = e.gpsLat;
        const lon = e.gpsLon;
        const gps =
          lat != null && lon != null && Number(lat) !== 0 && Number(lon) !== 0
            ? `${lat}, ${lon}`
            : "GPS: Not captured";
        dieselRows.push([
          String(idx + 1),
          String(e.litres ?? ""),
          String(e.rate ?? ""),
          `₹ ${Number(e.amount ?? 0).toFixed(2)}`,
          String(e.meter ?? "--"),
          String(e.bunkName || "--"),
          gps,
          e.submittedAt || "--",
          e.imageData ? "Persisted" : "--",
        ]);
      });
    } else {
      for (let i = 1; i <= 6; i++) {
        const submitted = (trip as any)[`dieselSubmitted${i}`];
        if (!submitted) continue;
        const ltr = Number((trip as any)[`dieselLtr${i}`] || 0);
        const rate = Number((trip as any)[`dieselRate${i}`] || 0);
        const amount = Number((trip as any)[`dieselAmount${i}`] ?? 0);
        const meter = (trip as any)[`dieselMeter${i}`] ?? "--";
        const bunk = (trip as any)[`dieselBunk${i}`] || "--";
        const lat = (trip as any)[`dieselGpsLat${i}`];
        const lon = (trip as any)[`dieselGpsLon${i}`];
        const gps =
          lat != null && lon != null && Number(lat) !== 0 && Number(lon) !== 0
            ? `${lat}, ${lon}`
            : "GPS: Not captured";
        dieselRows.push([
          String(dieselRows.length + 1),
          String(ltr),
          String(rate),
          `₹ ${amount.toFixed(2)}`,
          String(meter),
          String(bunk),
          gps,
          (trip as any)[`dieselSubmittedAt${i}`] || "--",
          (trip as any)[`dieselImage${i}`] ? "Persisted" : "--",
        ]);
      }
    }
    if (dieselRows.length) {
      doc.setFontSize(12);
      doc.text("Step 5 — Diesel / Fuel", margin, y);
      y += 4;
      autoTable(doc, {
        head: [["S.No", "Litres", "Rate", "Amount", "Meter", "Bunk", "GPS", "Submitted At", "Bill"]],
        body: dieselRows,
        startY: y,
        theme: "striped",
        headStyles: { fillColor: [5, 150, 105], textColor: 255 },
        styles: { fontSize: 8, cellPadding: 1.5 },
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 6;
    }

    const mileage = trip.mileageKmL;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Mileage: ${mileage != null && Number.isFinite(Number(mileage)) ? `${Number(mileage).toFixed(2)} km/L` : "Not available"}`,
      margin,
      y
    );
    y += 8;

    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    const totalText = `Total Shops: ${trip.totalShops}   Birds: ${trip.totalBirds}   Weight: ${trip.totalWeight.toFixed(2)} KG   Mortality: ${trip.totalMortality}`;
    doc.text(totalText, margin, y);

    const safeVehicleNo = trip.vehicleNo.replace(/[^a-zA-Z0-9]/g, "_");
    doc.save(`${trip.tripNo}_${safeVehicleNo}.pdf`);
  };

  const totalKmForPdf = (): number => {
    return trip.totalKm != null && Number.isFinite(Number(trip.totalKm))
      ? Number(trip.totalKm)
      : Number(trip.closingMeter || 0) - Number(trip.openingMeter || 0);
  };

  // ─── Dummy functions for read‑only steps (incomplete trips) ───
  const noop = () => {};
  const noopDispatch = () => {};

  const renderViewStep = () => {
    if (viewStepIndex === 0 && isStartCompleted) {
      return (
        <StepStart
          tripId={trip.id}
          tripNo={trip.tripNo}
          startTime={trip.startTime}
          startStepSubmitted={trip.startStepSubmitted}
          loadSnapshot={trip}
          updateTrip={noop}
          submitStartStep={async () => false}
          vehicleOptions={[]}
          employeeOptions={[]}
          subscribeHeaderSaveStatus={noopSubscribeSaveStatus}
          getHeaderSaveStatus={getIdleSaveStatus}
        />
      );
    }
    if (viewStepIndex === 1) {
      return <Step2View trip={trip} />;
    }
    if (viewStepIndex === 2) {
      return (
        <StepPickup
          trip={trip}
          setTrip={noopDispatch}
          updateTrip={noop}
          submitPickupStep={() => false}
          updateBoxDetails={noop}
        />
      );
    }
    if (viewStepIndex === 3 && isDeliveryCompleted) {
      return <StepDeliveries rows={trip.deliveries || []} setRows={noopDispatch} shops={shops} birdTypes={[]} trip={trip} updateDeliveries={noop} submitDeliveriesStep={() => false} clearForm={noop} readOnly={true} />;
    }
    if (viewStepIndex === 4 && isEndCompleted) {
      return (
        <StepEnd
          trip={trip}
          setTrip={noopDispatch}
          updateTrip={noop}
          submitExpensesStep={() => false}
          submitStartStep={() => false}
          editable={false}
          canEdit={false}
          onCancel={noop}
          clearForm={noop}
        />
      );
    }
    return <div className="mt-8 text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">Select a completed step to view its details.</div>;
  };

  const emailCounts = emailState.counts;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-7xl max-h-[92vh] overflow-hidden flex flex-col">
        {/* ─── Header ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 px-6 md:px-8 py-5 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/80">
          <div className="flex items-center gap-4 min-w-0">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white shrink-0">
              <FileText className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg md:text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2 flex-wrap">
                <span className="truncate">{trip.tripNo || "Trip Details"}</span>
                {isCompleted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 text-white px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    <ShieldCheck size={11} /> Submitted · Locked
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    {trip.status || "Pending"}
                  </span>
                )}
              </h2>
              <p className="text-xs font-medium text-slate-400 mt-1">Read-only trip overview</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end shrink-0">
            {isCompleted && (trip as any).approvedBy && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-200 shadow-sm">
                <UserCheck size={12} className="text-emerald-600" />
                Approved By: {(trip as any).approvedBy}
              </span>
            )}
            {isCompleted && emailCounts.total > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 border border-sky-200 shadow-sm" role="status" aria-live="polite">
                <Mail size={12} />
                {emailState.isBulkSending ? (
                  <>
                    Sending... {emailState.bulkProgress?.sent ?? emailCounts.sent} / {emailState.bulkProgress?.total ?? emailCounts.total}
                  </>
                ) : (
                  <>
                    {emailCounts.sent} Sent{emailCounts.pending > 0 ? ` · ${emailCounts.pending} Pending` : ""}
                    {emailCounts.failed > 0 ? ` · ${emailCounts.failed} Failed` : ""}
                  </>
                )}
              </span>
            )}
            {isCompleted && emailCounts.total > 0 && (
              <button
                type="button"
                onClick={() => void emailState.sendAll()}
                disabled={emailState.isBulkSending}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                title="Send email to all shops in this trip"
              >
                {emailState.isBulkSending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                {emailState.isBulkSending ? "Sending..." : "Send All Mail"}
              </button>
            )}
          </div>
        </div>

        {/* ─── Body ─────────────────────────────────────────────────── */}
        <div className="py-6 md:py-8 px-4 md:px-8 overflow-y-auto space-y-6 flex-1">
          {isCompleted ? (
            <>
              <TripViewSummary trip={trip} />
              <TripViewShopCards
                trip={trip}
                shops={shops}
                effectiveStatus={emailState.effectiveStatus}
                busyIds={emailState.busyIds}
                isBulkSending={emailState.isBulkSending}
                bulkProgress={emailState.bulkProgress}
                shopEmailFor={emailState.shopEmailFor}
                failureReasonFor={emailState.failureReasonFor}
                onSendOne={(delivery) => void emailState.sendOne(delivery)}
                onDownloadPdf={(delivery) => void downloadShopPDF(delivery)}
              />
              <TripFinalKPI trip={trip} deliveries={trip.deliveries} />
            </>
          ) : (
            <>
              <TripWizardStepper
                steps={TRIP_STEP_LABELS}
                currentStep={currentStep}
                completedMask={completedMask}
                onStepClick={setViewStepIndex}
              />
              <div className="mt-4">{renderViewStep()}</div>
              <TripFinalKPI trip={trip} deliveries={trip.deliveries} />
            </>
          )}
        </div>

        {/* ─── Footer ───────────────────────────────────────────────── */}
        <div className="px-6 md:px-8 py-5 border-t border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 flex items-center justify-end gap-3">
          <button onClick={downloadPDF} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 transition-all active:scale-95">
            <Download size={15} />
            Download PDF
          </button>
          <button onClick={onClose} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all active:scale-95">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(TripViewModal);