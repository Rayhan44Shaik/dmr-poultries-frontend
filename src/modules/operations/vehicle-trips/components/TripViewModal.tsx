import React from "react";
import { X, FileText, Download, CheckCircle2, AlertCircle, Calendar, Truck, User, Building2, Gauge, Fuel, DollarSign, MapPin, Hash, ShoppingCart, Layers, Scale, MessageSquare } from "lucide-react";
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
    doc.setTextColor(5, 150, 105);
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

    // Two-column summary (including DC Weight & Total Birds if needed in text summary structure)
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

    // Delivery table with S.No
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
      headStyles: {
        fillColor: [5, 150, 105],
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
      },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      styles: { fontSize: 9, cellPadding: 2 },
      columnStyles: {
        0: { halign: "center", cellWidth: 12 },
        1: { halign: "center", cellWidth: 15 },
        2: { halign: "left", cellWidth: 63 },
        3: { halign: "center", cellWidth: 20 },
        4: { halign: "center", cellWidth: 25 },
        5: { halign: "center", cellWidth: 25 },
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
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 w-full max-w-5xl max-h-[92vh] overflow-hidden flex flex-col">
        
        {/* Modern Header Section (Green Theme) */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/80">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-white">
              <FileText className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Trip Details</h2>
              <p className="text-xs font-medium text-slate-400 mt-0.5">Comprehensive overview and unloading records</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="h-10 w-10 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-all shadow-xs"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="p-8 overflow-y-auto space-y-6 flex-1">
          
          {/* Information Grid Cards (Including DC Weight & Total Birds) */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            
            <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 p-4 rounded-2xl border border-slate-100 shadow-xs flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100/70 text-emerald-600 mt-0.5">
                <Hash size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Trip No</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{trip.tripNo}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 p-4 rounded-2xl border border-slate-100 shadow-xs flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100/70 text-emerald-600 mt-0.5">
                <Calendar size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Trip Date</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{trip.tripDate}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 p-4 rounded-2xl border border-slate-100 shadow-xs flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100/70 text-emerald-600 mt-0.5">
                <Truck size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vehicle</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{trip.vehicleNo}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 p-4 rounded-2xl border border-slate-100 shadow-xs flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100/70 text-emerald-600 mt-0.5">
                <User size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Driver</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{trip.driverName}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 p-4 rounded-2xl border border-slate-100 shadow-xs flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100/70 text-emerald-600 mt-0.5">
                <User size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Supervisor</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{trip.supervisorName}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 p-4 rounded-2xl border border-slate-100 shadow-xs flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100/70 text-emerald-600 mt-0.5">
                <Building2 size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Source Farm</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{trip.sourceFarm}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 p-4 rounded-2xl border border-slate-100 shadow-xs flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100/70 text-emerald-600 mt-0.5">
                <Gauge size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Opening KM</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{trip.openingMeter}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 p-4 rounded-2xl border border-slate-100 shadow-xs flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100/70 text-emerald-600 mt-0.5">
                <Gauge size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Closing KM</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{trip.closingMeter}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 p-4 rounded-2xl border border-slate-100 shadow-xs flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100/70 text-emerald-600 mt-0.5">
                <MapPin size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total KM</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{totalKm}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 p-4 rounded-2xl border border-slate-100 shadow-xs flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100/70 text-emerald-600 mt-0.5">
                <Fuel size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fuel (Ltrs)</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{trip.fuel}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 p-4 rounded-2xl border border-slate-100 shadow-xs flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100/70 text-emerald-600 mt-0.5">
                <DollarSign size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Expense</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">₹ {trip.expense}</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 p-4 rounded-2xl border border-slate-100 shadow-xs flex items-start gap-3">
              <div className={`p-2.5 rounded-xl mt-0.5 ${trip.status === "Completed" ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"}`}>
                {trip.status === "Completed" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</p>
                <p className={`text-sm font-bold mt-0.5 ${trip.status === "Completed" ? "text-emerald-600" : "text-amber-600"}`}>
                  {trip.status}
                </p>
              </div>
            </div>

            {/* Added DC Weight */}
            <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 p-4 rounded-2xl border border-slate-100 shadow-xs flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100/70 text-emerald-600 mt-0.5">
                <Scale size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">DC Weight</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{(trip as any).dcWeight || 0} KG</p>
              </div>
            </div>

            {/* Added Total Birds */}
            <div className="bg-gradient-to-br from-slate-50 to-emerald-50/30 p-4 rounded-2xl border border-slate-100 shadow-xs flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-100/70 text-emerald-600 mt-0.5">
                <Layers size={18} />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Birds</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{trip.totalBirds || 0}</p>
              </div>
            </div>

          </div>

          {/* Remarks Section */}
          <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl shadow-xs">
            <div className="flex items-center gap-2 text-slate-400 mb-1.5">
              <MessageSquare size={16} />
              <p className="text-xs font-semibold uppercase tracking-wider">Remarks</p>
            </div>
            <p className="text-sm font-medium text-slate-700">{trip.remarks || "--"}</p>
          </div>

          {/* Deliveries Table Section */}
          <div className="border border-slate-100 rounded-3xl overflow-hidden bg-white shadow-sm">
            <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Unloading Records</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-500">
                    <th className="px-5 py-3.5 text-center text-xs font-semibold tracking-wider w-16">S.No</th>
                    <th className="px-5 py-3.5 text-center text-xs font-semibold tracking-wider">
                      <div className="flex items-center justify-center gap-1.5">
                        <Hash className="w-3.5 h-3.5 text-slate-400" />
                        <span>Box</span>
                      </div>
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold tracking-wider">
                      <div className="flex items-center gap-1.5">
                        <ShoppingCart className="w-3.5 h-3.5 text-slate-400" />
                        <span>Shop Name</span>
                      </div>
                    </th>
                    <th className="px-5 py-3.5 text-center text-xs font-semibold tracking-wider">
                      <div className="flex items-center justify-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        <span>Birds</span>
                      </div>
                    </th>
                    <th className="px-5 py-3.5 text-center text-xs font-semibold tracking-wider">
                      <div className="flex items-center justify-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-slate-400" />
                        <span>Weight (KG)</span>
                      </div>
                    </th>
                    <th className="px-5 py-3.5 text-center text-xs font-semibold tracking-wider">
                      <div className="flex items-center justify-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
                        <span>Remarks</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trip.deliveries.map((row, index) => (
                    <tr key={index} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 text-center text-xs font-bold text-slate-600">
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-lg bg-slate-100 text-slate-600">
                          {index + 1}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-center text-xs font-semibold text-slate-700">{row.boxNo}</td>
                      <td className="px-5 py-3.5 text-left text-xs font-semibold text-slate-800">{row.shopName}</td>
                      <td className="px-5 py-3.5 text-center text-xs font-semibold text-slate-700">{row.birds}</td>
                      <td className="px-5 py-3.5 text-center text-xs font-semibold text-slate-700">{row.weight.toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-center text-xs font-medium text-slate-500">{row.remarks || "--"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50/80 border-t border-slate-100">
                    <td colSpan={6} className="px-6 py-4">
                      <div className="flex flex-wrap items-center justify-center gap-8 text-xs font-semibold text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">Total Shops:</span>
                          <span className="text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200/60 shadow-2xs">{trip.totalShops}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">Birds:</span>
                          <span className="text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200/60 shadow-2xs">{trip.totalBirds}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">Weight:</span>
                          <span className="text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200/60 shadow-2xs">{trip.totalWeight.toFixed(2)} KG</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-400">Mortality:</span>
                          <span className="text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200/60 shadow-2xs">{trip.totalMortality}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-8 py-5 border-t border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-slate-50/80 flex items-center justify-end gap-3">
          <button 
            onClick={downloadPDF} 
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-semibold text-xs shadow-md shadow-emerald-500/20 transition-all active:scale-95"
          >
            <Download size={15} />
            Download PDF
          </button>
          <button 
            onClick={onClose} 
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-all active:scale-95"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}

export default React.memo(TripViewModal);