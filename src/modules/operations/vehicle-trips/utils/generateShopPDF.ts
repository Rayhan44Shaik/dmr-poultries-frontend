// src/modules/operations/vehicle-trips/utils/generateShopPDF.ts
//
// DMR POULTRY — Delivery Receipt PDF
// Pixel-matched to the two approved slip designs:
//   • Weight mode -> full slip (info card, table, totals, mortality, final blocks)
//   • Box mode    -> simple slip (info cards, table with TOTAL row, footer strip)
//
// Hen rendering fix: the previous version stripped every dark pixel (r,g,b < 65),
// which destroyed the bird's own outline + shading and left a flat 2D cut-out with
// black fringes. We now remove only the near-WHITE studio background, feather the
// edge alpha, and draw a soft blurred contact shadow instead of hard grey ellipses.

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { BoxDetail } from "../types/trip";
import { ShopDeliveryWithExtra } from "../components/Step_4/useShopDeliveryForm";

// ─── COLOR PALETTE ───────────────────────────────────────────────────────────
type RGB = [number, number, number];

const COLOR = {
  navy: [15, 35, 79] as RGB, // deep navy used for titles + header band
  tableHeader: [16, 42, 94] as RGB, // #102a5e
  brandRed: [178, 20, 34] as RGB, // #b21422
  cardBg: [252, 253, 255] as RGB,
  cardBorder: [219, 226, 238] as RGB,
  textDark: [26, 36, 54] as RGB,
  textMuted: [96, 110, 132] as RGB,
  tableAltRow: [246, 249, 253] as RGB,
  totalBg: [222, 231, 246] as RGB,
  white: [255, 255, 255] as RGB,
  pageBg: [255, 255, 255] as RGB,
};

const setFill = (doc: jsPDF, c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
const setDraw = (doc: jsPDF, c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);
const setText = (doc: jsPDF, c: RGB) => doc.setTextColor(c[0], c[1], c[2]);

// ─── HELPER: CLEAN THE HEN CUT-OUT (keeps 3D shading, kills white box + fringe)
async function cleanHenImage(
  src: string
): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve) => {
    const fallback = { dataUrl: src, width: 0, height: 0 };
    try {
      const img = new Image();
      img.crossOrigin = "Anonymous";

      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(fallback);

        ctx.drawImage(img, 0, 0);

        let imageData: ImageData;
        try {
          imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        } catch {
          // tainted canvas (cross-origin) -> use the original image untouched
          return resolve({ dataUrl: src, width: canvas.width, height: canvas.height });
        }

        const d = imageData.data;

        // 1) Remove only the near-WHITE background. Dark pixels (the hen's own
        //    outline, eye, shading, legs) are preserved so it still reads as 3D.
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          const min = Math.min(r, g, b);
          const max = Math.max(r, g, b);
          const chroma = max - min; // grey/white background has ~0 chroma

          if (min >= 244 && chroma <= 10) {
            d[i + 3] = 0; // pure background -> transparent
          } else if (min >= 228 && chroma <= 14) {
            // soft anti-aliased rim -> partial alpha, avoids a hard white halo
            d[i + 3] = Math.round(((min - 228) / 16) * 0 + ((244 - min) / 16) * 255);
          }
        }

        // 2) Feather: any opaque pixel touching a transparent one gets softened,
        //    which removes the "sticker" edge that made it look flat.
        const w = canvas.width;
        const h = canvas.height;
        const alpha = new Uint8ClampedArray(w * h);
        for (let p = 0; p < w * h; p++) alpha[p] = d[p * 4 + 3];

        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const p = y * w + x;
            if (alpha[p] === 0) continue;
            const neighbours =
              alpha[p - 1] + alpha[p + 1] + alpha[p - w] + alpha[p + w];
            if (neighbours < 4 * 255) {
              d[p * 4 + 3] = Math.min(alpha[p], Math.round(neighbours / 4));
            }
          }
        }

        ctx.clearRect(0, 0, w, h);
        ctx.putImageData(imageData, 0, 0);

        resolve({ dataUrl: canvas.toDataURL("image/png"), width: w, height: h });
      };

      img.onerror = () => resolve(fallback);
      img.src = src;
    } catch {
      resolve(fallback);
    }
  });
}

// ─── HELPER: SOFT CONTACT SHADOW (no hard outlines) ──────────────────────────
function drawSoftShadow(doc: jsPDF, cx: number, baseY: number, width: number) {
  const anyDoc = doc as any;
  doc.saveGraphicsState();
  for (let i = 6; i >= 1; i--) {
    const opacity = 0.035 * i;
    if (typeof anyDoc.GState === "function") {
      doc.setGState(new anyDoc.GState({ opacity }));
    }
    doc.setFillColor(150, 158, 172);
    doc.ellipse(cx, baseY, (width / 2) * (i / 6) * 0.75, 1.6 * (i / 6), "F");
  }
  doc.restoreGraphicsState();
}

// ─── HELPER: VECTOR FALLBACKS ────────────────────────────────────────────────
function drawDmrBrandLogo(doc: jsPDF, x: number, y: number, size = 22) {
  doc.saveGraphicsState();
  const cx = x + size / 2;
  const cy = y + size / 2;

  setFill(doc, COLOR.white);
  setDraw(doc, COLOR.tableHeader);
  doc.setLineWidth(0.9);
  doc.circle(cx, cy, size / 2 - 0.5, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setText(doc, COLOR.brandRed);
  doc.text("DMR", cx, cy + 1, { align: "center" });

  doc.setFontSize(4);
  setText(doc, COLOR.tableHeader);
  doc.text("POULTRY", cx, cy + 5, { align: "center" });

  doc.restoreGraphicsState();
}

function drawHenPlaceholder(doc: jsPDF, x: number, y: number, size = 24) {
  doc.saveGraphicsState();
  const cx = x + size / 2;
  const cy = y + size / 2;

  doc.setFillColor(238, 240, 244);
  doc.ellipse(cx, cy + 1, size / 2.6, size / 3.4, "F");
  doc.setFillColor(232, 234, 240);
  doc.circle(cx + size / 4, cy - size / 4, size / 7, "F");
  setFill(doc, COLOR.brandRed);
  doc.circle(cx + size / 4, cy - size / 2.4, size / 16, "F");

  doc.restoreGraphicsState();
}

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
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  setText(doc, COLOR.textDark);
  doc.text(label, x, y);
  doc.text(":", x + labelWidth - 4, y);

  const valueX = x + labelWidth;
  doc.setFont("helvetica", "normal");
  doc.text(value || "", valueX, y);

  setDraw(doc, [150, 163, 184]);
  doc.setLineWidth(0.3);
  doc.line(valueX, y + 1.6, valueX + lineWidth, y + 1.6);
}

// ─── HELPER: STAT CARD ───────────────────────────────────────────────────────
function drawStat(
  doc: jsPDF,
  label: string,
  value: string,
  x: number,
  y: number,
  valueColor: RGB,
  labelColor: RGB
) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  setText(doc, labelColor);
  doc.text(label.toUpperCase(), x, y);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  setText(doc, valueColor);
  doc.text(value, x, y + 7);
}

// ─── MAIN PDF GENERATOR ──────────────────────────────────────────────────────
export function generateShopPDF(
  row: ShopDeliveryWithExtra,
  safeBoxDetails: BoxDetail[] = [],
  tripNo?: string,
  vehicleNo?: string,
  supervisorName?: string,
  supervisorPhone?: string,
  tripDate?: string,
  logoLeftUrl?: string,
  henIconUrl?: string,
  deliveryTime?: string
): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 12;
      const contentWidth = pageWidth - margin * 2;

      const isBoxMode = row.deliveryMode === "box";
      const dateValue = tripDate || new Date().toISOString().split("T")[0];
      const timeValue = deliveryTime || "08:45 AM";

      // ─── 1. HEADER ────────────────────────────────────────────────────────
      const headerTop = 12;

      // Left logo
      if (logoLeftUrl) {
        try {
          doc.addImage(logoLeftUrl, "PNG", margin, headerTop, 24, 24, undefined, "FAST");
        } catch {
          drawDmrBrandLogo(doc, margin, headerTop, 24);
        }
      } else {
        drawDmrBrandLogo(doc, margin, headerTop, 24);
      }

      // Right hen (aspect-correct, transparent, soft shadow — never a 2D box)
      const henBoxW = 30;
      const henBoxH = 28;
      const henX = pageWidth - margin - henBoxW;
      const henY = headerTop - 2;

      let henDrawn = false;
      if (henIconUrl) {
        try {
          const { dataUrl, width, height } = await cleanHenImage(henIconUrl);
          let drawW = henBoxW;
          let drawH = henBoxH;
          if (width && height) {
            const ratio = Math.min(henBoxW / width, henBoxH / height);
            drawW = width * ratio;
            drawH = height * ratio;
          }
          const dx = henX + (henBoxW - drawW) / 2;
          const dy = henY + (henBoxH - drawH);

          drawSoftShadow(doc, dx + drawW / 2, dy + drawH - 0.5, drawW);
          doc.addImage(dataUrl, "PNG", dx, dy, drawW, drawH, undefined, "FAST");
          henDrawn = true;
        } catch {
          henDrawn = false;
        }
      }
      if (!henDrawn) drawHenPlaceholder(doc, henX, henY, henBoxH);

      // Centre title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(30);
      setText(doc, COLOR.navy);
      doc.text("DMR POULTRY", pageWidth / 2, headerTop + 14, { align: "center" });

      // Divider under title
      const dividerY = headerTop + 21;
      const dividerHalf = 52;
      if (isBoxMode) {
        setDraw(doc, [148, 163, 184]);
        doc.setLineWidth(0.3);
        doc.line(pageWidth / 2 - dividerHalf, dividerY, pageWidth / 2 - 5, dividerY);
        doc.line(pageWidth / 2 + 5, dividerY, pageWidth / 2 + dividerHalf, dividerY);
        setFill(doc, COLOR.navy);
        doc.circle(pageWidth / 2, dividerY, 0.9, "F");
      } else {
        setDraw(doc, COLOR.brandRed);
        doc.setLineWidth(0.5);
        doc.line(pageWidth / 2 - dividerHalf, dividerY, pageWidth / 2 - 14, dividerY);
        doc.line(pageWidth / 2 + 14, dividerY, pageWidth / 2 + dividerHalf, dividerY);
        doc.setFontSize(9);
        setText(doc, COLOR.brandRed);
        doc.text("*  *  *", pageWidth / 2, dividerY + 1.6, { align: "center" });
      }

      let currentY = headerTop + 28;

      // ─── 2. INFO CARDS ────────────────────────────────────────────────────
      const c1 = margin + 8;
      const c2 = margin + 100;

      if (isBoxMode) {
        // Card A: supervisor / vehicle / mobile
        const cardAH = 26;
        setFill(doc, COLOR.cardBg);
        setDraw(doc, COLOR.cardBorder);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, currentY, contentWidth, cardAH, 3, 3, "FD");

        drawField(doc, "Supervisor Name", supervisorName || "", c1, currentY + 10, 34, 48);
        drawField(doc, "Vehicle No", vehicleNo || "", c2, currentY + 10, 26, 48);
        drawField(doc, "Mobile No", supervisorPhone || "", c1, currentY + 20, 34, 48);

        currentY += cardAH + 5;

        // Card B: shop name | date (split)
        const cardBH = 18;
        setFill(doc, COLOR.cardBg);
        setDraw(doc, COLOR.cardBorder);
        doc.roundedRect(margin, currentY, contentWidth * 0.6 - 2, cardBH, 3, 3, "FD");
        doc.roundedRect(
          margin + contentWidth * 0.6 + 2,
          currentY,
          contentWidth * 0.4 - 2,
          cardBH,
          3,
          3,
          "FD"
        );

        drawField(doc, "Shop Name", row.shopName || "", c1, currentY + 11, 28, 62);
        drawField(
          doc,
          "Date",
          dateValue,
          margin + contentWidth * 0.6 + 10,
          currentY + 11,
          18,
          42
        );

        currentY += cardBH + 6;
      } else {
        const cardH = 36;
        setFill(doc, COLOR.cardBg);
        setDraw(doc, COLOR.cardBorder);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, currentY, contentWidth, cardH, 3, 3, "FD");

        drawField(doc, "Supervisor Name", supervisorName || "", c1, currentY + 8, 34, 48);
        drawField(doc, "Vehicle No", vehicleNo || "", c2, currentY + 8, 30, 48);
        drawField(doc, "Mobile No", supervisorPhone || "", c1, currentY + 16, 34, 48);

        // inner divider
        setDraw(doc, COLOR.cardBorder);
        doc.line(margin + 2, currentY + 20, pageWidth - margin - 2, currentY + 20);

        drawField(doc, "Shop Name", row.shopName || "", c1, currentY + 27, 34, 48);
        drawField(doc, "Date", dateValue, c2, currentY + 27, 30, 48);

        // Delivery type checkboxes
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        setText(doc, COLOR.textDark);
        doc.text("Delivery Type", c1, currentY + 33);
        doc.text(":", c1 + 30, currentY + 33);

        setDraw(doc, COLOR.textDark);
        doc.setLineWidth(0.35);
        doc.rect(c1 + 34, currentY + 30, 4, 4, "S");
        if (!isBoxMode) {
          doc.setLineWidth(0.6);
          doc.line(c1 + 35, currentY + 32.1, c1 + 35.9, currentY + 33.2);
          doc.line(c1 + 35.9, currentY + 33.2, c1 + 37.4, currentY + 30.7);
        }
        doc.text("Weight", c1 + 40, currentY + 33);

        doc.setLineWidth(0.35);
        doc.rect(c1 + 56, currentY + 30, 4, 4, "S");
        doc.text("Box", c1 + 62, currentY + 33);

        drawField(doc, "Time", timeValue, c2, currentY + 33, 30, 48);

        currentY += cardH + 6;
      }

      // ─── 3. TABLE ─────────────────────────────────────────────────────────
      const headers = isBoxMode
        ? ["Box No", "Birds No.", "Weight (Kg)"]
        : ["Box No", "Birds No.", "Weight (Farm) (kg)"];

      const tableRows: (string | number)[][] = [];
      let totalBirds = 0;
      let totalWeight = 0;

      const tableData = isBoxMode
        ? row.perBoxData || []
        : (() => {
            const selected = row.selectedBoxIds || [];
            return safeBoxDetails.filter((b) => selected.includes(b.boxNo));
          })();

      if (tableData.length === 0) {
        tableRows.push(["—", "—", "—"]);
      } else {
        tableData.forEach((item: any) => {
          const birds = Number(item.birds) || 0;
          const weight = Number(item.weight) || 0;
          tableRows.push([item.boxNo, birds.toLocaleString(), weight.toFixed(2)]);
          totalBirds += birds;
          totalWeight += weight;
        });
      }

      const hasTotalRow = isBoxMode && tableData.length > 0;
      if (hasTotalRow) {
        tableRows.push([
          `TOTAL     ${tableData.length}`,
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
          fontSize: 10,
          halign: "center",
          valign: "middle",
          cellPadding: { top: 3.4, bottom: 3.4 },
          lineColor: COLOR.tableHeader,
          lineWidth: 0.1,
        },
        styles: {
          font: "helvetica",
          fontSize: 9,
          cellPadding: { top: 2.1, bottom: 2.1 },
          valign: "middle",
          halign: "center",
          textColor: COLOR.textDark,
          lineColor: COLOR.cardBorder,
          lineWidth: 0.2,
        },
        columnStyles: {
          0: { halign: "center", cellWidth: contentWidth * 0.28 },
          1: { halign: "center", cellWidth: contentWidth * 0.34 },
          2: { halign: "center" },
        },
        alternateRowStyles: { fillColor: COLOR.tableAltRow },
        didParseCell: (data) => {
          if (
            hasTotalRow &&
            data.section === "body" &&
            data.row.index === tableRows.length - 1
          ) {
            data.cell.styles.fillColor = COLOR.totalBg;
            data.cell.styles.textColor = COLOR.tableHeader;
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.fontSize = 10;
            if (data.column.index === 0) data.cell.styles.halign = "left";
          }
        },
      });

      let finalY = (doc as any).lastAutoTable?.finalY ?? currentY + 40;

      // ─── 4. SUMMARY CARDS (WEIGHT MODE) ───────────────────────────────────
      if (!isBoxMode) {
        const mortalityBirds = Number(row.mortality) || 0;
        const mortalityWeight = Number(row.mortKg) || 0;
        const finalBirds = totalBirds - mortalityBirds;
        const finalWeight = totalWeight - mortalityWeight;

        finalY += 5;
        const cardW = (contentWidth - 4) / 2;

        // Row 1 — totals
        setFill(doc, COLOR.cardBg);
        setDraw(doc, COLOR.cardBorder);
        doc.setLineWidth(0.3);
        doc.roundedRect(margin, finalY, contentWidth, 16, 2.5, 2.5, "FD");
        doc.line(pageWidth / 2, finalY + 3, pageWidth / 2, finalY + 13);
        drawStat(
          doc,
          "Total Boxes",
          `${tableData.length}`,
          margin + 10,
          finalY + 6,
          COLOR.textDark,
          COLOR.tableHeader
        );
        drawStat(
          doc,
          "Total Weight (Farm)",
          `${totalWeight.toFixed(2)} kg`,
          pageWidth / 2 + 10,
          finalY + 6,
          COLOR.brandRed,
          COLOR.tableHeader
        );

        finalY += 20;

        // Row 2 — mortality
        setFill(doc, COLOR.cardBg);
        setDraw(doc, COLOR.cardBorder);
        doc.roundedRect(margin, finalY, contentWidth, 16, 2.5, 2.5, "FD");
        doc.line(pageWidth / 2, finalY + 3, pageWidth / 2, finalY + 13);
        drawStat(
          doc,
          "Mortality",
          `${mortalityBirds}`,
          margin + 10,
          finalY + 6,
          COLOR.brandRed,
          COLOR.tableHeader
        );
        drawStat(
          doc,
          "Mortality (Kg)",
          `${mortalityWeight.toFixed(2)} kg`,
          pageWidth / 2 + 10,
          finalY + 6,
          COLOR.brandRed,
          COLOR.tableHeader
        );

        finalY += 20;

        // Row 3 — final blocks (navy | red)
        setFill(doc, COLOR.tableHeader);
        doc.roundedRect(margin, finalY, cardW, 19, 2.5, 2.5, "F");
        drawStat(
          doc,
          "Final Birds",
          `${finalBirds.toLocaleString()}`,
          margin + 10,
          finalY + 6,
          COLOR.white,
          COLOR.white
        );

        setFill(doc, COLOR.brandRed);
        doc.roundedRect(margin + cardW + 4, finalY, cardW, 19, 2.5, 2.5, "F");
        drawStat(
          doc,
          "Final Weight",
          `${finalWeight.toFixed(2)} kg`,
          margin + cardW + 14,
          finalY + 6,
          COLOR.white,
          COLOR.white
        );
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        setText(doc, COLOR.white);
        doc.text(
          "(AFTER MORTALITY DEDUCTION)",
          margin + cardW + 14,
          finalY + 16.5
        );

        finalY += 25;
      }

      // ─── 5. FOOTER ────────────────────────────────────────────────────────
      const footerY = isBoxMode ? pageHeight - 26 : Math.min(finalY + 12, pageHeight - 20);

      setDraw(doc, [148, 163, 184]);
      doc.setLineWidth(0.3);
      doc.line(margin + 12, footerY - 4, pageWidth / 2 - 34, footerY - 4);
      doc.line(pageWidth / 2 + 34, footerY - 4, pageWidth - margin - 12, footerY - 4);

      setText(doc, COLOR.brandRed);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("~", pageWidth / 2 - 30, footerY, { align: "center" });
      doc.text("~", pageWidth / 2 + 30, footerY, { align: "center" });

      doc.setFont("times", "italic");
      doc.setFontSize(24);
      setText(doc, COLOR.navy);
      doc.text(isBoxMode ? "Thank You" : "Thank You!", pageWidth / 2, footerY + 1, {
        align: "center",
      });

      if (!isBoxMode) {
        doc.setFont("times", "normal");
        doc.setFontSize(11);
        setText(doc, COLOR.navy);
        doc.text("We appreciate your business", pageWidth / 2, footerY + 8, {
          align: "center",
        });
      }

      // Bottom decorative strip (box mode)
      if (isBoxMode) {
        setFill(doc, COLOR.brandRed);
        doc.rect(0, pageHeight - 9, pageWidth, 2.4, "F");
        setFill(doc, COLOR.white);
        doc.rect(0, pageHeight - 6.6, pageWidth, 0.9, "F");
        setFill(doc, COLOR.tableHeader);
        doc.rect(0, pageHeight - 5.7, pageWidth, 5.7, "F");
      }

      // ─── 6. DOWNLOAD ──────────────────────────────────────────────────────
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

      resolve();
    } catch (error: any) {
      reject(new Error(error?.message || "Failed to generate PDF receipt."));
    }
  });
}
