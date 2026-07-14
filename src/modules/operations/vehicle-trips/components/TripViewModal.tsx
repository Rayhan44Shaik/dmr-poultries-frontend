import React from "react";
import { X } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Trip } from "../types/trip";

interface Props {
  open: boolean;
  trip: Trip | null;
  onClose: () => void;
}

function TripViewModal({ open, trip, onClose }: Props) {
  if (!open || !trip) return null;

  const totalKm = (trip.closingMeter || 0) - (trip.openingMeter || 0);

  const downloadPDF = () => {
    const doc = new jsPDF("p", "mm", "a4");
    const margin = 16;
    let y = 20;

    // Title
    doc.setFontSize(18);
    doc.setTextColor(30, 58, 138);
    doc.text("Trip Details", margin, y);
    y += 8;

    // Date
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const dateStr = new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    doc.text(`Generated on: ${dateStr}`, margin, y);
    y += 6;

    // Two‑column summary
    const summaryData = [
      ["Trip No", trip.tripNo, "Vehicle", trip.vehicleNo],
      ["Trip Date", trip.tripDate, "Driver", trip.driverName],
      ["Supervisor", trip.supervisorName, "Source Farm", trip.sourceFarm],
      ["Opening KM", trip.openingMeter.toString(), "Closing KM", trip.closingMeter.toString()],
      ["Total KM", totalKm.toString(), "Fuel (Ltrs)", trip.fuel.toString()],
      ["Expense", `₹ ${trip.expense}`, "Status", trip.status],
    ];

    autoTable(doc, {
      body: summaryData.map((row) => [row[0], row[1], row[2], row[3]]),
      startY: y,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 30, fontStyle: "bold", textColor: [80, 80, 80] },
        1: { cellWidth: 45 },
        2: { cellWidth: 30, fontStyle: "bold", textColor: [80, 80, 80] },
        3: { cellWidth: 45 },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // Remarks
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text("Remarks:", margin, y);
    y += 5;
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    doc.text(trip.remarks || "--", margin, y);
    y += 8;

    // Delivery table
    const tableHeaders = ["Box", "Shop Name", "Birds", "Weight (KG)", "Remarks"];
    const tableRows = trip.deliveries.map((row) => [
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
      headStyles: {
        fillColor: [30, 58, 138],
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { halign: "center", cellWidth: 15 },
        1: { cellWidth: 70 },
        2: { halign: "center", cellWidth: 20 },
        3: { halign: "center", cellWidth: 25 },
        4: { cellWidth: 30 },
      },
      margin: { left: margin, right: margin },
    });
    y = (doc as any).lastAutoTable.finalY + 6;

    // Totals
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    const totalText = `Total Shops: ${trip.totalShops}   Birds: ${trip.totalBirds}   Weight: ${trip.totalWeight.toFixed(2)} KG   Mortality: ${trip.totalMortality}`;
    doc.text(totalText, margin, y);

    const safeVehicleNo = trip.vehicleNo.replace(/[^a-zA-Z0-9]/g, "_");
    doc.save(`${trip.tripNo}_${safeVehicleNo}.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Trip Details</h2>
          <button onClick={onClose} className="h-10 w-10 rounded-full hover:bg-slate-100 flex items-center justify-center">
            <X size={24} />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6 bg-slate-50 p-4 rounded-xl">
          <div><p className="text-xs font-medium text-slate-500">Trip No</p><p className="text-sm font-semibold text-slate-800">{trip.tripNo}</p></div>
          <div><p className="text-xs font-medium text-slate-500">Trip Date</p><p className="text-sm font-semibold text-slate-800">{trip.tripDate}</p></div>
          <div><p className="text-xs font-medium text-slate-500">Vehicle</p><p className="text-sm font-semibold text-slate-800">{trip.vehicleNo}</p></div>
          <div><p className="text-xs font-medium text-slate-500">Driver</p><p className="text-sm font-semibold text-slate-800">{trip.driverName}</p></div>
          <div><p className="text-xs font-medium text-slate-500">Supervisor</p><p className="text-sm font-semibold text-slate-800">{trip.supervisorName}</p></div>
          <div><p className="text-xs font-medium text-slate-500">Source Farm</p><p className="text-sm font-semibold text-slate-800">{trip.sourceFarm}</p></div>
          <div><p className="text-xs font-medium text-slate-500">Opening KM</p><p className="text-sm font-semibold text-slate-800">{trip.openingMeter}</p></div>
          <div><p className="text-xs font-medium text-slate-500">Closing KM</p><p className="text-sm font-semibold text-slate-800">{trip.closingMeter}</p></div>
          <div><p className="text-xs font-medium text-slate-500">Total KM</p><p className="text-sm font-semibold text-slate-800">{totalKm}</p></div>
          <div><p className="text-xs font-medium text-slate-500">Fuel (Ltrs)</p><p className="text-sm font-semibold text-slate-800">{trip.fuel}</p></div>
          <div><p className="text-xs font-medium text-slate-500">Expense</p><p className="text-sm font-semibold text-slate-800">₹ {trip.expense}</p></div>
          <div><p className="text-xs font-medium text-slate-500">Status</p><p className={`text-sm font-semibold ${trip.status === "Completed" ? "text-green-600" : "text-yellow-600"}`}>{trip.status}</p></div>
        </div>

        <div className="border rounded-xl p-4 bg-slate-50 mb-6">
          <p className="text-xs font-medium text-slate-500">Remarks</p>
          <p className="text-sm text-slate-700">{trip.remarks || "--"}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-slate-600">Box</th>
                <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-slate-600">Shop Name</th>
                <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-slate-600">Birds</th>
                <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-slate-600">Weight (KG)</th>
                <th className="px-4 py-2 text-center text-xs font-medium uppercase tracking-wider text-slate-600">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {trip.deliveries.map((row, index) => (
                <tr key={index} className="border-t hover:bg-slate-50">
                  <td className="px-4 py-2 text-center text-sm text-slate-700">{row.boxNo}</td>
                  <td className="px-4 py-2 text-center text-sm text-slate-700">{row.shopName}</td>
                  <td className="px-4 py-2 text-center text-sm text-slate-700">{row.birds}</td>
                  <td className="px-4 py-2 text-center text-sm text-slate-700">{row.weight.toFixed(2)}</td>
                  <td className="px-4 py-2 text-center text-sm text-slate-700">{row.remarks || "--"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 font-semibold">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-center">
                  <div className="flex flex-wrap justify-center gap-4 text-sm">
                    <span>Total Shops : <b>{trip.totalShops}</b></span>
                    <span>Birds : <b>{trip.totalBirds}</b></span>
                    <span>Weight : <b>{trip.totalWeight.toFixed(2)} KG</b></span>
                    <span>Mortality : <b>{trip.totalMortality}</b></span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button onClick={downloadPDF} className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-colors">
            Download PDF
          </button>
          <button onClick={onClose} className="px-6 py-2 rounded-xl bg-green-700 hover:bg-green-800 text-white shadow-md transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default React.memo(TripViewModal);