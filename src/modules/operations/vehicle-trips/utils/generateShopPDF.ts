// src/modules/operations/vehicle-trips/utils/generateShopPDF.ts
//
// DMR POULTRY — Clean Black & White Delivery Receipt PDF
// Minimalist, high-legibility A4 format supporting Box Mode & Weight Mode.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { BoxDetail } from "../types/trip";
import type { ShopDeliveryWithExtra } from "../components/Step_4/useShopDeliveryForm";
import henImage from "../components/Step_4/Hen_Image.webp";
import { drawDmrPoultryHeader } from "./drawDmrPoultryHeader";

// ─── MONOCHROME & ACCENT COLOR PALETTE ──────────────────────────────────────
type RGB = [number, number, number];

const COLOR = {
  black: [0, 0, 0] as RGB,
  textDark: [20, 20, 20] as RGB,
  textMuted: [90, 90, 90] as RGB,
  tableHeader: [35, 35, 35] as RGB,
  borderLight: [200, 200, 200] as RGB,
  cardBg: [250, 250, 250] as RGB,
  tableAltRow: [248, 248, 248] as RGB,
  totalBg: [235, 235, 235] as RGB,
  white: [255, 255, 255] as RGB,
  finalDarkBlue: [22, 38, 66] as RGB,
  finalDarkRed: [142, 30, 30] as RGB,
  accentRed: [142, 30, 30] as RGB,
};

const setFill = (doc: jsPDF, c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
const setDraw = (doc: jsPDF, c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
const setText = (doc: jsPDF, c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

// ─── HELPER: LABELLED FIELD WITH RULE LINE ───────────────────────────────────
function drawField(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  labelWidth: number,
  lineWidth: number
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  setText(doc, COLOR.textDark);
  doc.text(label, x, y);
  doc.text(":", x + labelWidth - 3, y);

  const valueX = x + labelWidth;
  doc.setFont("helvetica", "normal");
  doc.text(value || "", valueX, y);

  setDraw(doc, COLOR.borderLight);
  doc.setLineWidth(0.25);
  doc.line(valueX, y + 1.5, valueX + lineWidth, y + 1.5);
}

// ─── MAIN PDF GENERATOR ──────────────────────────────────────────────────────
export async function generateShopPDF(
  row: ShopDeliveryWithExtra,
  safeBoxDetails: BoxDetail[] = [],
  _tripNo?: string,
  vehicleNo?: string,
  supervisorName?: string,
  supervisorPhone?: string,
  tripDate?: string,
  logoLeftUrl?: string,
  henIconUrl?: string,
  deliveryTime?: string
): Promise<void> {
  try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 12;
      const contentWidth = pageWidth - margin * 2;

      const isBoxMode = row.deliveryMode === "box";

      // ─── 1. ROBUST RESOLUTION FOR SUPERVISOR DETAILS ──────────────────────
      const resolvedSupervisorName = 
        supervisorName || 
        (row as any).supervisorName || 
        (row as any).supervisor || 
        "";

      let resolvedSupervisorPhone = 
        supervisorPhone || 
        (row as any).supervisorPhone || 
        (row as any).supervisorMobile || 
        (row as any).supervisorPhoneNo || 
        (row as any).phone || 
        (row as any).employee?.phoneNumber ||
        "";

      // --- EMPLOYEE DIRECTORY FALLBACK LOOKUP ---
      if (!resolvedSupervisorPhone && resolvedSupervisorName) {
        try {
          const empStorage = localStorage.getItem("dmr-employees");
          if (empStorage) {
            const employees = JSON.parse(empStorage);
            const matchedEmp = employees.find(
              (emp: any) =>
                emp.employeeName?.trim().toLowerCase() === resolvedSupervisorName.trim().toLowerCase()
            );
            if (matchedEmp && matchedEmp.phoneNumber) {
              resolvedSupervisorPhone = matchedEmp.phoneNumber;
            }
          }
        } catch (err) {
          console.error("Error looking up supervisor phone from employee master:", err);
        }
      }

      // ─── EXACT CAPTURE FROM SHOP CARD (PRIORITIZING row.autoCaptureTime) ────
      const storedDeliveryTime = 
        (row as any).autoCaptureTime || 
        (row as any).deliveredAt || 
        (row as any).deliveryTime || 
        (row as any).deliveryTimestamp || 
        (row as any).timestamp || 
        (row as any).createdAt || 
        (row as any).date || 
        (row as any).time ||
        deliveryTime;

      let dateValue = tripDate || "";
      let timeValue = "";

      if (storedDeliveryTime) {
        if (typeof storedDeliveryTime === "string" && storedDeliveryTime.includes(",")) {
          const parts = storedDeliveryTime.split(",");
          dateValue = parts[0].trim();
          timeValue = parts[1].trim();
        } else if (typeof storedDeliveryTime === "string") {
          timeValue = storedDeliveryTime;
        } else {
          const parsedDate = new Date(storedDeliveryTime);
          if (!isNaN(parsedDate.getTime())) {
            dateValue = parsedDate.toLocaleDateString();
            timeValue = parsedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
          }
        }
      }

      if (!dateValue) {
        dateValue = new Date().toLocaleDateString();
      }
      if (!timeValue) {
        timeValue = "Just now";
      }

      // ─── 2. REUSABLE DMR HEADER ──────────────────────────────────────────
      // The left logo is vector based. The right hen is background-removed,
      // cropped and aspect-fitted by the shared header helper.
      let currentY = await drawDmrPoultryHeader(doc, {
        margin,
        top: 10,
        logoUrl: logoLeftUrl,
        henUrl: henIconUrl || henImage,
        subtitle: "Delivery Receipt",
      });

      currentY += 4;

      // ─── 3. UNIFIED INFO CARD (IDENTICAL LAYOUT FOR BOTH MODES) ──────────
      const c1 = margin + 6;
      const c2 = margin + 98;
      const cardH = 44;

      setFill(doc, COLOR.cardBg);
      setDraw(doc, COLOR.borderLight);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, currentY, contentWidth, cardH, 2, 2, "FD");

      // Top Row details with guaranteed fallback resolution
      drawField(doc, "Supervisor Name", resolvedSupervisorName, c1, currentY + 9, 34, 48);
      drawField(doc, "Vehicle No", vehicleNo || "", c2, currentY + 9, 30, 48);
      drawField(doc, "Mobile No", resolvedSupervisorPhone, c1, currentY + 18, 34, 48);

      // Inner Divider
      setDraw(doc, COLOR.borderLight);
      doc.line(margin + 2, currentY + 23, pageWidth - margin - 2, currentY + 23);

      // Bottom Row details (Shop Name & Date)
      drawField(doc, "Shop Name", row.shopName || "", c1, currentY + 31, 34, 48);
      drawField(doc, "Date", dateValue, c2, currentY + 31, 30, 48);

      // Delivery Type & Time Row
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      setText(doc, COLOR.textDark);
      doc.text("Delivery Type", c1, currentY + 38);
      doc.text(":", c1 + 30, currentY + 38);

      // Weight Checkbox
      setDraw(doc, COLOR.black);
      doc.setLineWidth(0.4);
      doc.rect(c1 + 34, currentY + 35.5, 3.5, 3.5, "S");
      if (!isBoxMode) {
        doc.setLineWidth(0.6);
        doc.line(c1 + 34.8, currentY + 37.2, c1 + 35.6, currentY + 38.3);
        doc.line(c1 + 35.6, currentY + 38.3, c1 + 37.1, currentY + 36.1);
      }
      doc.setFont("helvetica", "normal");
      doc.text("Weight", c1 + 39, currentY + 38);

      // Box Checkbox
      doc.setLineWidth(0.4);
      doc.rect(c1 + 55, currentY + 35.5, 3.5, 3.5, "S");
      if (isBoxMode) {
        doc.setLineWidth(0.6);
        doc.line(c1 + 55.8, currentY + 37.2, c1 + 56.6, currentY + 38.3);
        doc.line(c1 + 56.6, currentY + 38.3, c1 + 58.1, currentY + 36.1);
      }
      doc.setFont("helvetica", "normal");
      doc.text("Box", c1 + 60, currentY + 38);

      drawField(doc, "Time", timeValue, c2, currentY + 38, 30, 48);

      currentY += cardH + 8;

      // ─── 4. TABLE SETUP ───────────────────────────────────────────────────
      const headers = isBoxMode
        ? ["Box No", "Birds Delivered", "Weight (Kg)"]
        : ["Box No", "Birds Delivered", "Delivered Weight (Kg)"];

      const tableRows: (string | number)[][] = [];
      let totalBirds = 0;
      let totalWeight = 0;

      const shopDeliveredWeight = Number(
        (row as any).deliveredWeight ??
        (row as any).totalWeight ??
        (row as any).weightKg ??
        (row as any).weight ??
        0
      );

      if (isBoxMode) {
        const boxDataSource =
          row.perBoxData && row.perBoxData.length > 0
            ? row.perBoxData
            : (row as any).boxDetails && (row as any).boxDetails.length > 0
            ? (row as any).boxDetails
            : (row as any).boxes && (row as any).boxes.length > 0
            ? (row as any).boxes
            : row.selectedBoxIds && row.selectedBoxIds.length > 0
            ? safeBoxDetails.filter((b) => row.selectedBoxIds?.includes(b.boxNo))
            : [];

        if (boxDataSource.length === 0) {
          tableRows.push(["—", "—", "—"]);
        } else {
          boxDataSource.forEach((item: any) => {
            const bNo = item.boxNo || item.boxNumber || item.id || "—";
            const birds = Number(item.birds ?? item.birdCount ?? item.noOfBirds ?? 0);
            const weight = Number(item.weight ?? item.farmWeight ?? item.weightKg ?? 0);
            tableRows.push([bNo, birds.toLocaleString(), weight.toFixed(2)]);
            totalBirds += birds;
            totalWeight += weight;
          });
        }
      } else {
        const selected = row.selectedBoxIds || [];
        const selectedBoxes = safeBoxDetails.filter((b) => selected.includes(b.boxNo));

        const totalFarmWeight = selectedBoxes.reduce((acc, b) => acc + (Number(b.weight) || 0), 0);
        const totalBoxBirds = selectedBoxes.reduce((acc, b) => acc + (Number(b.birds) || 0), 0);
        
        const targetTotalWeight = shopDeliveredWeight > 0 ? shopDeliveredWeight : totalFarmWeight;

        if (selectedBoxes.length === 0) {
          tableRows.push(["—", "—", "—"]);
        } else {
          selectedBoxes.forEach((item: any) => {
            const birds = Number(item.birds) || 0;
            const farmWt = Number(item.weight) || 0;

            let boxDeliveredWt = 0;
            if (totalFarmWeight > 0) {
              boxDeliveredWt = (farmWt / totalFarmWeight) * targetTotalWeight;
            } else if (totalBoxBirds > 0) {
              boxDeliveredWt = (birds / totalBoxBirds) * targetTotalWeight;
            } else {
              boxDeliveredWt = targetTotalWeight / selectedBoxes.length;
            }

            tableRows.push([item.boxNo, birds.toLocaleString(), boxDeliveredWt.toFixed(2)]);
            totalBirds += birds;
          });
          totalWeight = targetTotalWeight;
        }
      }

      const boxCount = isBoxMode
        ? (row.perBoxData?.length || (row as any).boxDetails?.length || (row as any).boxes?.length || row.selectedBoxIds?.length || 0)
        : (row.selectedBoxIds || []).length;

      if (!isBoxMode && boxCount > 0 && tableRows.length > 0 && tableRows[0][0] !== "—") {
        tableRows.push([
          `TOTAL (${boxCount} Boxes)`,
          totalBirds.toLocaleString(),
          totalWeight.toFixed(2),
        ]);
      }

      autoTable(doc, {
        startY: currentY,
        head: [headers],
        body: tableRows,
        theme: "grid",
        margin: { left: margin, right: margin },
        headStyles: {
          fillColor: COLOR.tableHeader,
          textColor: COLOR.white,
          fontStyle: "bold",
          fontSize: 9.5,
          halign: "center",
          valign: "middle",
          cellPadding: { top: 3.5, bottom: 3.5 },
          lineColor: COLOR.tableHeader,
          lineWidth: 0.1,
        },
        styles: {
          font: "helvetica",
          fontSize: 9,
          cellPadding: { top: 2.5, bottom: 2.5 },
          valign: "middle",
          halign: "center",
          textColor: COLOR.textDark,
          lineColor: COLOR.borderLight,
          lineWidth: 0.2,
        },
        columnStyles: {
          0: { halign: "center", cellWidth: contentWidth * 0.3 },
          1: { halign: "center", cellWidth: contentWidth * 0.35 },
          2: { halign: "center" },
        },
        alternateRowStyles: { fillColor: COLOR.tableAltRow },
        didParseCell: (data) => {
          if (
            !isBoxMode &&
            boxCount > 0 &&
            data.section === "body" &&
            data.row.index === tableRows.length - 1 &&
            tableRows[0][0] !== "—"
          ) {
            data.cell.styles.fillColor = COLOR.totalBg;
            data.cell.styles.textColor = COLOR.black;
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fontSize = 9.5;
            if (data.column.index === 0) data.cell.styles.halign = "left";
          }
        },
      });

      let finalY = (doc as any).lastAutoTable?.finalY ?? currentY + 40;

      // ─── 5. SUMMARY TABLE FOR BOX MODE (MATCHING DESIRED LAYOUT) ──────────
      if (isBoxMode) {
        finalY += 4;

        const mortalityBirdsVal = Number(
          (row as any).mortalityBirds ?? 
          (row as any).mortality ?? 
          (row as any).deadBirds ?? 
          0
        );

        let mortalityWeightVal = Number(
          (row as any).mortalityWeight ?? 
          (row as any).mortalityKg ?? 
          (row as any).mortalityWt ?? 
          (row as any).deadWeight ?? 
          0
        );

        if (mortalityWeightVal === 0 && mortalityBirdsVal > 0 && totalBirds > 0 && totalWeight > 0) {
          const avgWeightPerBird = totalWeight / totalBirds;
          mortalityWeightVal = mortalityBirdsVal * avgWeightPerBird;
        }

        const finalBirdsVal = Math.max(0, totalBirds - mortalityBirdsVal);
        const finalWeightVal = Math.max(0, totalWeight - mortalityWeightVal);

        const summaryHeaders = ["Boxes", "Birds", "Weight(Kg)", "Mortality", "Mortality(KG)"];
        const summaryRows = [
          [
            boxCount,
            totalBirds.toLocaleString(),
            totalWeight.toFixed(2),
            mortalityBirdsVal,
            mortalityWeightVal.toFixed(2)
          ],
          [
            "",
            "",
            "",
            `Final Birds: ${finalBirdsVal}`,
            `Final Weight: ${finalWeightVal.toFixed(2)} kg`
          ]
        ];

        autoTable(doc, {
          startY: finalY,
          head: [summaryHeaders],
          body: summaryRows,
          theme: "grid",
          margin: { left: margin, right: margin },
          headStyles: {
            fillColor: COLOR.tableHeader,
            textColor: COLOR.white,
            fontStyle: "bold",
            fontSize: 8.5,
            halign: "center",
            valign: "middle",
            cellPadding: { top: 2.5, bottom: 2.5 },
            lineColor: COLOR.tableHeader,
            lineWidth: 0.1,
          },
          styles: {
            font: "helvetica",
            fontSize: 8.5,
            cellPadding: { top: 2, bottom: 2 },
            valign: "middle",
            halign: "center",
            textColor: COLOR.textDark,
            lineColor: COLOR.borderLight,
            lineWidth: 0.2,
          },
          columnStyles: {
            0: { cellWidth: contentWidth * 0.18 },
            1: { cellWidth: contentWidth * 0.20 },
            2: { cellWidth: contentWidth * 0.22 },
            3: { cellWidth: contentWidth * 0.20 },
            4: { cellWidth: contentWidth * 0.20 },
          },
          didParseCell: (data) => {
            if (data.section === "body" && data.row.index === 1) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = COLOR.totalBg;
              if (data.column.index >= 3) {
                data.cell.styles.textColor = COLOR.finalDarkBlue;
              }
            }
          },
        });

        finalY = (doc as any).lastAutoTable?.finalY ?? finalY + 20;
      }

      // ─── 6. STYLISH & COLORFUL THANK YOU BANNER ───────────────────────────
      const thanksY = Math.min(Math.max(finalY + 12, pageHeight - 32), pageHeight - 24);

      setDraw(doc, COLOR.finalDarkBlue);
      doc.setLineWidth(0.4);
      doc.line(margin + 8, thanksY + 3, pageWidth / 2 - 28, thanksY + 3);
      doc.line(pageWidth / 2 + 28, thanksY + 3, pageWidth - margin - 8, thanksY + 3);

      setFill(doc, COLOR.accentRed);
      doc.circle(pageWidth / 2 - 24, thanksY + 3, 1, "F");
      doc.circle(pageWidth / 2 - 21, thanksY + 2.2, 0.75, "F");
      doc.circle(pageWidth / 2 - 21, thanksY + 3.8, 0.75, "F");

      doc.circle(pageWidth / 2 + 24, thanksY + 3, 1, "F");
      doc.circle(pageWidth / 2 + 21, thanksY + 2.2, 0.75, "F");
      doc.circle(pageWidth / 2 + 21, thanksY + 3.8, 0.75, "F");

      doc.setFont("times", "italic");
      doc.setFontSize(15);
      setText(doc, COLOR.finalDarkBlue);
      doc.text("Thank You!", pageWidth / 2, thanksY + 4.5, { align: "center" });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      setText(doc, COLOR.textDark);
      doc.text("We appreciate your business", pageWidth / 2, thanksY + 10, { align: "center" });

      // ─── 7. DOWNLOAD PDF FILE ──────────────────────────────────────────────
      const suffix = isBoxMode ? "Box" : "Weight";
      const cleanShopName = (row.shopName || "Shop").replace(/\s+/g, "_");

      const pdfBlob = doc.output("blob");
      const blobUrl = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `DeliveryReceipt_${cleanShopName}_${suffix}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
    } catch (error: unknown) {
      if (error instanceof Error) throw error;
      throw new Error("Failed to generate PDF receipt.", { cause: error });
    }
}