// src/modules/operations/vehicle-trips/components/TripViewModal.tsx

import React, { useState, useCallback } from "react";
import { X, FileText, Download, Pencil, UserCheck, Box, Users, Scale, Clock, Store, AlertTriangle } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Trip } from "../types/trip";

// --- Import the Steps to render them inside the View Modal ---
import TripWizardStepper from "./TripWizardStepper";
import StepStart from "./StepStart";
import StepFarm from "./StepFarm";
import StepEnd from "./Step_5/StepEnd";
import TripFinalKPI from "./TripFinalKPI";

interface Props {
  open: boolean;
  trip: Trip | null;
  onClose: () => void;
  shops: any[];
  birdTypes: any[];
  onEdit?: (trip: Trip) => void;
}

function TripViewModal({ open, trip, onClose, shops, birdTypes, onEdit }: Props) {
  const [viewStepIndex, setViewStepIndex] = useState(0);

  // ─── HOOKS MUST BE CALLED BEFORE EARLY RETURNS ─────────────────
  const noopSubscribeSaveStatus = useCallback((_listener: () => void) => () => {}, []);
  const getIdleSaveStatus = useCallback(() => "idle" as const, []);

  // ─── Early return – ensures trip is never null after this ─────
  if (!open || !trip) return null;

  // Now TypeScript knows trip is definitely a Trip object
  const totalKm = (trip.closingMeter || 0) - (trip.openingMeter || 0);

  // ─── STEP STATE FLAGS ───
  const isStartCompleted = trip.startStepSubmitted;
  const isFarmCompleted = trip.farmStepSubmitted;
  const isPickupCompleted = trip.pickupStepSubmitted;
  const isDeliveryCompleted = trip.deliveryStepSubmitted;
  const isEndCompleted = (trip as any).endStepSubmitted === true || trip.status === "Completed";
  const isTripEnded = trip.status === "Completed";

  const currentStep = isTripEnded ? 4
    : (isEndCompleted ? 4
      : (isDeliveryCompleted ? 3
        : (isPickupCompleted ? 2
          : (isFarmCompleted ? 1
            : (isStartCompleted ? 0 : 0)))));

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
      ["Opening KM", trip.openingMeter.toString(), "Closing KM", trip.closingMeter.toString()],
      ["Total KM", totalKm.toString(), "Fuel (Ltrs)", trip.fuel.toString()],
      ["Expense", `₹ ${trip.expense}`, "Status", trip.status],
      ["DC Weight", `${(trip as any).dcWeight || 0} KG`, "Total Birds", `${trip.totalBirds || 0}`],
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

    const tableHeaders = ["S.No", "Box", "Shop Name", "Birds", "Weight (KG)", "Remarks"];
    const tableRows = trip.deliveries.map((row, index) => [
      (index + 1).toString(),
      row.boxNo.toString(),
      row.shopName,
      row.birds.toString(),
      row.weight.toFixed(2),
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

    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    const totalText = `Total Shops: ${trip.totalShops}   Birds: ${trip.totalBirds}   Weight: ${trip.totalWeight.toFixed(2)} KG   Mortality: ${trip.totalMortality}`;
    doc.text(totalText, margin, y);

    const safeVehicleNo = trip.vehicleNo.replace(/[^a-zA-Z0-9]/g, "_");
    doc.save(`${trip.tripNo}_${safeVehicleNo}.pdf`);
  };

  // ─── Dummy functions for read‑only steps ──────────────────────
  const noop = () => {};
  const noopDispatch = () => {};

  // ─── Custom Read-Only Views for Pickup and Deliveries ─────────
  const renderReadOnlyPickup = () => {
    const boxes = trip.boxDetails || [];
    const dcWeight = (trip as any).dcWeight || trip.totalWeight || 0;
    
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <span className="bg-blue-600 text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">3</span>
            <h3 className="text-base font-bold text-slate-800">PICKUP DETAILS</h3>
          </div>
          <span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-200">
            Completed & Locked
          </span>
        </div>

        {/* Pickup KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
              <Clock size={12} className="text-slate-500" /> Time
            </span>
            <span className="text-sm font-bold text-slate-800">{trip.pickupLoadTime || "--"}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
              <Scale size={12} className="text-emerald-500" /> DC Wt
            </span>
            <span className="text-sm font-bold text-slate-800">{dcWeight.toFixed(2)} KG</span>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
              <Users size={12} className="text-blue-500" /> Birds
            </span>
            <span className="text-sm font-bold text-slate-800">{trip.totalBirds}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
              <Box size={12} className="text-amber-500" /> Boxes
            </span>
            <span className="text-sm font-bold text-slate-800">{trip.boxes || boxes.length}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
              <AlertTriangle size={12} className="text-purple-500" /> Avg Wt
            </span>
            <span className="text-sm font-bold text-slate-800">
              {trip.avgWeight ? trip.avgWeight.toFixed(3) : (trip.totalBirds > 0 ? (dcWeight / trip.totalBirds).toFixed(3) : "0.000")} KG
            </span>
          </div>
        </div>

        {/* Box Wise Data Table */}
        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-slate-100/60 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider">Box Number</th>
                <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider text-center">Birds</th>
                <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider text-center">Weight (KG)</th>
                <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider text-center">Avg Bird Wt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {boxes.map((b, i) => {
                const avg = b.birds > 0 ? (b.weight / b.birds).toFixed(3) : "0.000";
                return (
                  <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 font-semibold text-slate-700">Box {b.boxNo || i + 1}</td>
                    <td className="px-4 py-3 text-center font-bold text-blue-600">{b.birds}</td>
                    <td className="px-4 py-3 text-center font-bold text-emerald-600">{b.weight?.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{avg} KG</td>
                  </tr>
                );
              })}
              {boxes.length === 0 && (
                <tr><td colSpan={4} className="text-center py-6 text-slate-400">No box details recorded for this trip.</td></tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800">
              <tr>
                <td className="px-4 py-3 text-right text-xs uppercase tracking-wider">TOTAL</td>
                <td className="px-4 py-3 text-center text-blue-700">{trip.totalBirds}</td>
                <td className="px-4 py-3 text-center text-emerald-700">{dcWeight.toFixed(2)} KG</td>
                <td className="px-4 py-3 text-center text-slate-700">
                  {trip.avgWeight ? trip.avgWeight.toFixed(3) : (trip.totalBirds > 0 ? (dcWeight / trip.totalBirds).toFixed(3) : "0.000")} KG
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  const renderReadOnlyDeliveries = () => {
    const deliveries = trip.deliveries || [];
    const totalDeliveredWeight = (trip as any).totalDeliveredWeight ?? trip.totalWeight ?? 0;
    const totalDeliveredBirds = (trip as any).totalBirdsDelivered ?? trip.totalBirds ?? 0;
    const totalMortality = (trip as any).totalMortalityCount ?? trip.totalMortality ?? 0;

    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <span className="bg-blue-600 text-white w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">4</span>
            <h3 className="text-base font-bold text-slate-800">SHOP DELIVERIES</h3>
          </div>
          <span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full text-xs font-semibold border border-emerald-200">
            Completed & Locked
          </span>
        </div>

        {/* Delivery KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
              <Store size={12} className="text-blue-500" /> Total Shops
            </span>
            <span className="text-sm font-bold text-slate-800">{trip.totalShops || deliveries.length}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
              <Users size={12} className="text-indigo-500" /> Delivered Birds
            </span>
            <span className="text-sm font-bold text-slate-800">{totalDeliveredBirds}</span>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
              <Scale size={12} className="text-emerald-500" /> Delivered Weight
            </span>
            <span className="text-sm font-bold text-slate-800">{totalDeliveredWeight.toFixed(2)} KG</span>
          </div>
          <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
              <AlertTriangle size={12} className="text-rose-500" /> Mortality
            </span>
            <span className="text-sm font-bold text-slate-800">{totalMortality}</span>
          </div>
        </div>

        {/* Deliveries Table (Scrollable for 20+ shops) */}
        <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[450px] overflow-y-auto">
          <table className="min-w-full text-sm text-left relative">
            <thead className="bg-slate-100/90 border-b border-slate-200 text-slate-600 sticky top-0 z-10 backdrop-blur-sm">
              <tr className="whitespace-nowrap">
                <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider">S.No</th>
                <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider">Box No</th>
                <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider">Shop Name</th>
                <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider">Bird Type</th>
                <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider text-center">Birds</th>
                <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider text-center">Weight (KG)</th>
                <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider text-center">Rate</th>
                <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider text-center">Amount</th>
                <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider text-center">Mortality</th>
                <th className="px-4 py-3 font-bold uppercase text-[11px] tracking-wider">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {deliveries.map((d, i) => (
                <tr key={d.id || i} className="hover:bg-slate-50/60 transition-colors whitespace-nowrap">
                  <td className="px-4 py-3 text-slate-500 font-medium">{i + 1}</td>
                  <td className="px-4 py-3 font-semibold text-slate-700">{d.boxNo || "--"}</td>
                  <td className="px-4 py-3 font-bold text-slate-800">{d.shopName || "Unknown Shop"}</td>
                  <td className="px-4 py-3 text-slate-600">{d.birdType || "--"}</td>
                  <td className="px-4 py-3 text-center text-blue-600 font-bold">{d.birds}</td>
                  <td className="px-4 py-3 text-center text-emerald-600 font-bold">{d.weight?.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{d.rate ? `₹${d.rate}` : "--"}</td>
                  <td className="px-4 py-3 text-center text-emerald-700 font-bold">{d.amount ? `₹${d.amount}` : "--"}</td>
                  <td className="px-4 py-3 text-center text-rose-600 font-bold">{d.mortality || 0}</td>
                  <td className="px-4 py-3 text-slate-500 truncate max-w-[150px]" title={d.remarks}>{d.remarks || "--"}</td>
                </tr>
              ))}
              {deliveries.length === 0 && (
                <tr><td colSpan={10} className="text-center py-8 text-slate-400">No deliveries recorded for this trip.</td></tr>
              )}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800 sticky bottom-0 z-10">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-right text-xs uppercase tracking-wider">TOTAL</td>
                <td className="px-4 py-3 text-center text-blue-700">{totalDeliveredBirds}</td>
                <td className="px-4 py-3 text-center text-emerald-700">{totalDeliveredWeight.toFixed(2)} KG</td>
                <td className="px-4 py-3 text-center text-slate-400">--</td>
                <td className="px-4 py-3 text-center text-slate-400">--</td>
                <td className="px-4 py-3 text-center text-rose-600">{totalMortality}</td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  };

  // ─── Render the selected step ──────────────────────────────────
  const renderViewStep = () => {
    if (viewStepIndex === 0 && isStartCompleted) {
      return (
        <StepStart
          tripId={trip.id}
          startTime={trip.startTime}
          startStepSubmitted={trip.startStepSubmitted}
          loadSnapshot={trip}
          updateTrip={noop}
          submitStartStep={async () => "View only mode."}
          vehicleOptions={[]}
          employeeOptions={[]}
          subscribeHeaderSaveStatus={noopSubscribeSaveStatus}
          getHeaderSaveStatus={getIdleSaveStatus}
        />
      );
    }
    if (viewStepIndex === 1 && isFarmCompleted) {
      return <StepFarm trip={trip} setTrip={noopDispatch} updateTrip={noop} submitFarmStep={async () => "View only mode."} farms={[]} />;
    }
    if (viewStepIndex === 2 && isPickupCompleted) {
      // ✅ Render custom detailed Read-Only Pickup View
      return renderReadOnlyPickup();
    }
    if (viewStepIndex === 3 && isDeliveryCompleted) {
      // ✅ Render custom detailed Read-Only Deliveries View
      return renderReadOnlyDeliveries();
    }
    if (viewStepIndex === 4 && isEndCompleted) {
      return (
        <StepEnd
          trip={trip}
          setTrip={noopDispatch}
          updateTrip={noop}
          submitExpensesStep={async () => "View only mode."}
          submitStartStep={async () => "View only mode."}
          editable={false}
          canEdit={false}
          onCancel={noop}
          clearForm={noop}
        />
      );
    }
    return <div className="mt-8 text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">Select a completed step to view its details.</div>;
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in">
      {/* Expanded Modal Width to max-w-7xl to prevent cramped KPIs */}
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-7xl max-h-[92vh] overflow-hidden flex flex-col">
        
        <div className="flex items-center justify-between px-10 py-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/80 shrink-0">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white">
              <FileText className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Trip Details</h2>
              <p className="text-xs font-medium text-slate-400 mt-0.5">Comprehensive overview</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {trip.status === "Completed" && (trip as any).approvedBy && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 border border-emerald-200 shadow-sm">
                <UserCheck size={12} />
                {`Approved by: ${(trip as any).approvedBy}`}
              </span>
            )}
            <button onClick={onClose} className="h-10 w-10 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all shadow-xs">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="py-8 px-10 overflow-y-auto space-y-6 flex-1 bg-slate-50/30">
          
          <TripWizardStepper
            steps={["Start", "Farm", "Pickup", "Deliveries", "End"]}
            currentStep={currentStep}
            completedMask={
              {
                start: isStartCompleted,
                farm: isFarmCompleted,
                pickup: isPickupCompleted,
                delivery: isDeliveryCompleted,
                end: isEndCompleted,
              } as any
            }
            onStepClick={setViewStepIndex}
          />

          <div className="mt-4">
            {renderViewStep()}
          </div>

          <TripFinalKPI trip={trip} deliveries={trip.deliveries} />
        </div>

        <div className="px-10 py-5 border-t border-slate-100 bg-white flex items-center justify-end gap-3 shrink-0">
          {onEdit && (
            <button onClick={() => onEdit(trip)} className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all active:scale-95">
              <Pencil size={15} />
              Edit Trip
            </button>
          )}
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