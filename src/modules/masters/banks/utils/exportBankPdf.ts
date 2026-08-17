import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import henImage from "../../../../../assets/dmr-hen.jpg";

import {
  drawPreparedDmrPoultryHeader,
  prepareDmrPoultryHeaderAssets,
  type DmrPoultryHeaderAssets,
} from "../../../../utils/drawDmrPoultryHeader";

import type { Bank } from "../types/bank";

type RGB = [number, number, number];

const COLOR = {
  navy: [15, 35, 79] as RGB,
  red: [178, 20, 34] as RGB,
  slate: [71, 85, 105] as RGB,
  muted: [100, 116, 139] as RGB,
  border: [218, 226, 237] as RGB,
  header: [20, 50, 99] as RGB,
  headerAccent: [178, 20, 34] as RGB,
  white: [255, 255, 255] as RGB,
  rowAlt: [247, 249, 252] as RGB,
  summaryBg: [248, 250, 252] as RGB,
  activeText: [21, 128, 61] as RGB,
  activeBg: [220, 252, 231] as RGB,
  inactiveText: [185, 28, 28] as RGB,
  inactiveBg: [254, 226, 226] as RGB,
};

const PAGE_MARGIN = 14;
const TABLE_START_Y = 66;
const FOOTER_Y = 200;

function setText(
  doc: jsPDF,
  color: RGB
) {
  doc.setTextColor(
    color[0],
    color[1],
    color[2]
  );
}

function setFill(
  doc: jsPDF,
  color: RGB
) {
  doc.setFillColor(
    color[0],
    color[1],
    color[2]
  );
}

function setDraw(
  doc: jsPDF,
  color: RGB
) {
  doc.setDrawColor(
    color[0],
    color[1],
    color[2]
  );
}

function formatGeneratedAt(
  date: Date
) {
  return new Intl.DateTimeFormat(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }
  ).format(date);
}

function drawMetric(
  doc: jsPDF,
  label: string,
  value: number,
  x: number,
  y: number,
  width: number,
  valueColor: RGB
) {
  setFill(doc, COLOR.white);
  setDraw(doc, COLOR.border);

  doc.setLineWidth(0.25);

  doc.roundedRect(
    x,
    y,
    width,
    14,
    2,
    2,
    "FD"
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);

  setText(doc, valueColor);

  doc.text(
    String(value),
    x + 4,
    y + 6.2
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.4);

  setText(doc, COLOR.muted);

  doc.text(
    label.toUpperCase(),
    x + 4,
    y + 10.7,
    {
      charSpace: 0.35,
    }
  );
}

function drawPageHeader(
  doc: jsPDF,
  banks: Bank[],
  generatedAt: string,
  assets: DmrPoultryHeaderAssets
) {
  const pageWidth =
    doc.internal.pageSize.getWidth();

  const activeCount =
    banks.filter(
      (bank) =>
        bank.status === "Active"
    ).length;

  const inactiveCount =
    banks.length - activeCount;

  const headerBottom =
    drawPreparedDmrPoultryHeader(
      doc,
      {
        margin: PAGE_MARGIN,
        top: 7,
        title: "DMR POULTRY",
        subtitle:
          "Banks Master Directory",
      },
      assets
    );

  const summaryY =
    headerBottom + 1;

  setFill(doc, COLOR.summaryBg);
  setDraw(doc, COLOR.border);

  doc.setLineWidth(0.3);

  doc.roundedRect(
    PAGE_MARGIN,
    summaryY,
    pageWidth -
      PAGE_MARGIN * 2,
    18,
    2.5,
    2.5,
    "FD"
  );

  doc.setFont(
    "helvetica",
    "bold"
  );

  doc.setFontSize(11.5);

  setText(doc, COLOR.navy);

  doc.text(
    "Bank Accounts & Payment Directory",
    PAGE_MARGIN + 5,
    summaryY + 7
  );

  doc.setFont(
    "helvetica",
    "normal"
  );

  doc.setFontSize(7.5);

  setText(doc, COLOR.muted);

  doc.text(
    `Generated: ${generatedAt}`,
    PAGE_MARGIN + 5,
    summaryY + 12.5
  );

  const metricWidth = 27;
  const metricGap = 3;

  const metricsStartX =
    pageWidth -
    PAGE_MARGIN -
    metricWidth * 3 -
    metricGap * 2 -
    3;

  drawMetric(
    doc,
    "Total",
    banks.length,
    metricsStartX,
    summaryY + 2,
    metricWidth,
    COLOR.navy
  );

  drawMetric(
    doc,
    "Active",
    activeCount,
    metricsStartX +
      metricWidth +
      metricGap,
    summaryY + 2,
    metricWidth,
    COLOR.activeText
  );

  drawMetric(
    doc,
    "Inactive",
    inactiveCount,
    metricsStartX +
      (metricWidth + metricGap) * 2,
    summaryY + 2,
    metricWidth,
    COLOR.inactiveText
  );
}

function drawFooters(
  doc: jsPDF,
  generatedAt: string
) {
  const pageWidth =
    doc.internal.pageSize.getWidth();

  const totalPages =
    doc.getNumberOfPages();

  for (
    let pageNumber = 1;
    pageNumber <= totalPages;
    pageNumber += 1
  ) {
    doc.setPage(pageNumber);

    setDraw(doc, COLOR.border);

    doc.setLineWidth(0.25);

    doc.line(
      PAGE_MARGIN,
      FOOTER_Y - 4,
      pageWidth - PAGE_MARGIN,
      FOOTER_Y - 4
    );

    doc.setFont(
      "helvetica",
      "normal"
    );

    doc.setFontSize(7.2);

    setText(doc, COLOR.muted);

    doc.text(
      "DMR Poultry • Banks Master Directory • Confidential",
      PAGE_MARGIN,
      FOOTER_Y
    );

    doc.text(
      generatedAt,
      pageWidth / 2,
      FOOTER_Y,
      {
        align: "center",
      }
    );

    doc.setFont(
      "helvetica",
      "bold"
    );

    setText(doc, COLOR.navy);

    doc.text(
      `Page ${pageNumber} of ${totalPages}`,
      pageWidth - PAGE_MARGIN,
      FOOTER_Y,
      {
        align: "right",
      }
    );
  }
}

/**
 * Generates and downloads the complete branded Banks PDF.
 *
 * The Excel exporter is separate and remains unchanged.
 */
export async function exportBanksToPDF(
  banks: Bank[],
  filename: string
): Promise<void> {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const generatedAt =
    formatGeneratedAt(new Date());

  // Process the hen only once and reuse it on every PDF page.
  const assets =
    await prepareDmrPoultryHeaderAssets({
      henUrl: henImage,
    });

  const sortedBanks = [...banks].sort(
    (first, second) =>
      first.bankNo - second.bankNo
  );

  const rows = sortedBanks.map(
    (bank) => [
      String(bank.bankNo),
      bank.bankName,
      bank.branch,
      bank.accountNumber,
      bank.ifscCode,
      bank.upiId || "-",
      bank.status,
    ]
  );

  autoTable(doc, {
    startY: TABLE_START_Y,

    margin: {
      top: TABLE_START_Y,
      right: PAGE_MARGIN,
      bottom: 17,
      left: PAGE_MARGIN,
    },

    tableWidth: "auto",

    head: [
      [
        "BANK NO",
        "BANK NAME",
        "BRANCH",
        "ACCOUNT NUMBER",
        "IFSC CODE",
        "UPI ID",
        "STATUS",
      ],
    ],

    body: rows,

    theme: "grid",
    showHead: "everyPage",
    rowPageBreak: "avoid",

    styles: {
      font: "helvetica",
      fontSize: 8.2,
      minCellHeight: 8.5,

      cellPadding: {
        top: 2.7,
        right: 2.8,
        bottom: 2.7,
        left: 2.8,
      },

      valign: "middle",
      textColor: COLOR.slate,
      lineColor: COLOR.border,
      lineWidth: 0.18,
      overflow: "linebreak",
    },

    headStyles: {
      fillColor: COLOR.header,
      textColor: COLOR.white,
      fontStyle: "bold",
      fontSize: 7.5,
      minCellHeight: 10,
      halign: "left",
      valign: "middle",
      lineColor: [61, 83, 123],
      lineWidth: 0.2,
    },

    alternateRowStyles: {
      fillColor: COLOR.rowAlt,
    },

    columnStyles: {
      0: {
        cellWidth: 16,
        halign: "center",
        fontStyle: "bold",
        textColor: COLOR.navy,
      },

      1: {
        cellWidth: 48,
        fontStyle: "bold",
        textColor: COLOR.navy,
      },

      2: {
        cellWidth: 42,
      },

      3: {
        cellWidth: 49,
      },

      4: {
        cellWidth: 36,
        fontStyle: "bold",
      },

      5: {
        cellWidth: 51,
      },

      6: {
        cellWidth: 27,
        halign: "center",
        fontStyle: "bold",
      },
    },

    didParseCell: (data) => {
      if (
        data.section === "head" &&
        data.column.index === 0
      ) {
        data.cell.styles.fillColor =
          COLOR.headerAccent;
      }

      // Hide normal status text because a custom status pill is drawn below.
      if (
        data.section === "body" &&
        data.column.index === 6
      ) {
        data.cell.text = [];
      }
    },

    didDrawCell: (data) => {
      if (
        data.section !== "body" ||
        data.column.index !== 6
      ) {
        return;
      }

      const status = String(
        data.cell.raw ?? "Inactive"
      );

      const active =
        status === "Active";

      const pillWidth = 17;
      const pillHeight = 5.5;

      const pillX =
        data.cell.x +
        (data.cell.width -
          pillWidth) /
          2;

      const pillY =
        data.cell.y +
        (data.cell.height -
          pillHeight) /
          2;

      setFill(
        doc,
        active
          ? COLOR.activeBg
          : COLOR.inactiveBg
      );

      doc.roundedRect(
        pillX,
        pillY,
        pillWidth,
        pillHeight,
        2.5,
        2.5,
        "F"
      );

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(6.7);

      setText(
        doc,
        active
          ? COLOR.activeText
          : COLOR.inactiveText
      );

      doc.text(
        status,
        data.cell.x +
          data.cell.width / 2,
        pillY + 3.8,
        {
          align: "center",
        }
      );
    },

    // Draw the full DMR header on every PDF page.
    willDrawPage: () => {
      drawPageHeader(
        doc,
        sortedBanks,
        generatedAt,
        assets
      );
    },
  });

  drawFooters(
    doc,
    generatedAt
  );

  doc.save(`${filename}.pdf`);
}