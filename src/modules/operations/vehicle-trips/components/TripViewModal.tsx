import React, { useState } from "react";
import { X, FileText, Download, Pencil } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Trip } from "../types/trip";

// --- Import the Steps to render them inside the View Modal ---
import TripWizardStepper from "./TripWizardStepper";
import StepStart from "./StepStart";
import StepFarm from "./StepFarm";
import StepPickup from "./StepPickup";
import StepDeliveries from "./StepDeliveries";
import StepEnd from "./StepEnd"; // ✅ Ensure this is imported
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

  if (!open || !trip) return null;

  const totalKm = (trip.closingMeter || 0) - (trip.openingMeter || 0);

  // ─── STEP STATE FLAGS ───
  const isStartCompleted = trip.startStepSubmitted;
  const isFarmCompleted = trip.farmStepSubmitted;
  const isPickupCompleted = trip.pickupStepSubmitted;
  const isDeliveryCompleted = trip.deliveryStepSubmitted;
  const isTripEnded = trip.status === "Completed";
  const currentStep = isTripEnded ? 5 : (isDeliveryCompleted ? 4 : (isPickupCompleted ? 3 : (isFarmCompleted ? 2 : (isStartCompleted ? 1 : 0))));

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

  // Dummy functions to make the steps read-only in View Mode
  const noop = () => {};
  const noopDispatch = () => {};

  // 🔹 UPDATED: Properly renders Step 5 even if the trip is Pending (but Step 4 is locked)
  const renderViewStep = () => {
    if (viewStepIndex === 0 && isStartCompleted) {
      return <StepStart trip={trip} setTrip={noopDispatch} updateTrip={noop} submitStartStep={() => false} vehicleOptions={[]} employeeOptions={[]} />;
    }
    if (viewStepIndex === 1 && isFarmCompleted) {
      return <StepFarm trip={trip} setTrip={noopDispatch} updateTrip={noop} submitFarmStep={() => false} farms={[]} />;
    }
    if (viewStepIndex === 2 && isPickupCompleted) {
      return <StepPickup trip={trip} setTrip={noopDispatch} updateTrip={noop} submitPickupStep={() => false} />;
    }
    if (viewStepIndex === 3 && isDeliveryCompleted) {
      return <StepDeliveries rows={trip.deliveries || []} setRows={noopDispatch} shops={shops} birdTypes={birdTypes} trip={trip} updateDeliveries={noop} submitDeliveriesStep={() => false} clearForm={noop} readOnly={true} />;
    }
    if (viewStepIndex === 4 && isTripEnded) {
      return <div className="mt-8 bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center"><h2 className="text-2xl font-bold text-emerald-700">🎉 Trip Completed Successfully</h2></div>;
    }
    // ✅ NEW CONDITION: Shows Step 5 when Step 4 is locked, but the trip is still pending!
    if (viewStepIndex === 4 && !isTripEnded && isDeliveryCompleted) {
      return <StepEnd trip={trip} setTrip={noopDispatch} updateTrip={noop} submitEndTrip={() => false} />;
    }
    return <div className="mt-8 text-center p-12 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm">Select a completed step to view its details.</div>;
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/80">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white">
              <FileText className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Trip Details</h2>
              <p className="text-xs font-medium text-slate-400 mt-0.5">Comprehensive overview</p>
            </div>
          </div>
          <button onClick={onClose} className="h-10 w-10 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all shadow-xs">
            <X size={20} />
          </button>
        </div>

        <div className="p-8 overflow-y-auto space-y-6 flex-1">
          
          <TripWizardStepper
            steps={["Start", "Farm", "Pickup", "Deliveries", "End"]}
            currentStep={currentStep}
            completedMask={{
              start: isStartCompleted,
              farm: isFarmCompleted,
              pickup: isPickupCompleted,
              delivery: isDeliveryCompleted,
            }}
            onStepClick={setViewStepIndex}
          />

          <div className="mt-4">
            {renderViewStep()}
          </div>

          <TripFinalKPI trip={trip} />
        </div>

        <div className="px-8 py-5 border-t border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 flex items-center justify-end gap-3">
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