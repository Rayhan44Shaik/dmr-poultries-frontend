import type jsPDF from "jspdf";

type RGB = [number, number, number];

type PreparedImage = {
  dataUrl: string;
  width: number;
  height: number;
};

export interface DmrPoultryHeaderOptions {
  /** Left/right page inset in the same unit used to create the jsPDF document. */
  margin?: number;
  /** Top edge of the header. */
  top?: number;
  /** Optional replacement for the vector DMR logo. */
  logoUrl?: string;
  /** Hen image URL. The image is cut out automatically before it is drawn. */
  henUrl?: string;
  title?: string;
  subtitle?: string;
}

const NAVY: RGB = [15, 35, 79];
const RED: RGB = [178, 20, 34];
const WHITE: RGB = [255, 255, 255];

const setFill = (doc: jsPDF, color: RGB) =>
  doc.setFillColor(color[0], color[1], color[2]);
const setDraw = (doc: jsPDF, color: RGB) =>
  doc.setDrawColor(color[0], color[1], color[2]);
const setText = (doc: jsPDF, color: RGB) =>
  doc.setTextColor(color[0], color[1], color[2]);

/**
 * Draws the left DMR badge entirely with jsPDF vectors, so it remains sharp at
 * every print size and does not depend on a separate logo file.
 */
export function drawDmrLogo(doc: jsPDF, x: number, y: number, size = 24) {
  doc.saveGraphicsState();

  const centerX = x + size / 2;
  const centerY = y + size / 2;
  const radius = size / 2 - 0.6;

  setFill(doc, WHITE);
  setDraw(doc, NAVY);
  doc.setLineWidth(0.9);
  doc.circle(centerX, centerY, radius, "FD");

  setDraw(doc, RED);
  doc.setLineWidth(0.45);
  doc.circle(centerX, centerY, radius - 1.8, "S");

  // Small red crown gives the badge a poultry identity without using an icon
  // font, which may not be available in exported PDFs.
  setFill(doc, RED);
  doc.triangle(
    centerX - 4.2,
    centerY - 4.1,
    centerX - 2.3,
    centerY - 7.1,
    centerX - 0.8,
    centerY - 4.1,
    "F"
  );
  doc.triangle(
    centerX - 1.2,
    centerY - 4.1,
    centerX + 0.7,
    centerY - 7.7,
    centerX + 2.2,
    centerY - 4.1,
    "F"
  );
  doc.triangle(
    centerX + 1.7,
    centerY - 4.1,
    centerX + 3.8,
    centerY - 6.8,
    centerX + 4.8,
    centerY - 3.8,
    "F"
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  setText(doc, RED);
  doc.text("DMR", centerX, centerY + 1.6, { align: "center" });

  doc.setFontSize(4.8);
  setText(doc, NAVY);
  doc.text("POULTRY", centerX, centerY + 6.1, { align: "center" });

  doc.restoreGraphicsState();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load header image: ${src}`));
    image.src = src;
  });
}

function imageToCanvas(image: HTMLImageElement) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;

  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || canvas.width === 0 || canvas.height === 0) {
    throw new Error("Unable to create a canvas for the header image.");
  }

  context.drawImage(image, 0, 0);
  return { canvas, context };
}

async function prepareLogoImage(src: string): Promise<PreparedImage> {
  const image = await loadImage(src);
  const { canvas } = imageToCanvas(image);
  return {
    dataUrl: canvas.toDataURL("image/png"),
    width: canvas.width,
    height: canvas.height,
  };
}

function getBorderBackground(
  pixels: Uint8ClampedArray,
  width: number,
  height: number
): RGB {
  const red: number[] = [];
  const green: number[] = [];
  const blue: number[] = [];
  const step = Math.max(1, Math.floor(Math.min(width, height) / 100));

  const sample = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    red.push(pixels[offset]);
    green.push(pixels[offset + 1]);
    blue.push(pixels[offset + 2]);
  };

  for (let x = 0; x < width; x += step) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 0; y < height; y += step) {
    sample(0, y);
    sample(width - 1, y);
  }

  const median = (values: number[]) => {
    values.sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)] ?? 0;
  };

  return [median(red), median(green), median(blue)];
}

/**
 * Removes only the background connected to the image border. This is safer
 * than deleting every black (or every white) pixel: dark eye/feather details
 * inside the hen remain intact while the rectangular studio background and
 * JPEG fringe disappear.
 */
export async function prepareHenCutout(src: string): Promise<PreparedImage> {
  const image = await loadImage(src);
  const { canvas, context } = imageToCanvas(image);
  const width = canvas.width;
  const height = canvas.height;
  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const background = getBorderBackground(pixels, width, height);
  const backgroundLuminance =
    background[0] * 0.2126 + background[1] * 0.7152 + background[2] * 0.0722;

  // Dark JPEG backgrounds need a wider tolerance to consume compression noise.
  // White/neutral backgrounds use a tighter value to protect pale feathers.
  const tolerance = backgroundLuminance < 45 ? 108 : backgroundLuminance > 215 ? 42 : 62;
  const pixelCount = width * height;
  const removed = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let queueStart = 0;
  let queueEnd = 0;

  const matchesBackground = (position: number) => {
    const offset = position * 4;
    if (pixels[offset + 3] === 0) return true;
    return (
      Math.abs(pixels[offset] - background[0]) <= tolerance &&
      Math.abs(pixels[offset + 1] - background[1]) <= tolerance &&
      Math.abs(pixels[offset + 2] - background[2]) <= tolerance
    );
  };

  const enqueue = (position: number) => {
    if (removed[position] || !matchesBackground(position)) return;
    removed[position] = 1;
    queue[queueEnd++] = position;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (queueStart < queueEnd) {
    const position = queue[queueStart++];
    const x = position % width;
    const y = Math.floor(position / width);

    if (x > 0) enqueue(position - 1);
    if (x + 1 < width) enqueue(position + 1);
    if (y > 0) enqueue(position - width);
    if (y + 1 < height) enqueue(position + width);
  }

  // Transparent background plus a two-pixel feathered edge prevents a dark
  // JPEG halo from appearing around the white bird in the PDF.
  const edge = new Uint8Array(pixelCount);
  for (let position = 0; position < pixelCount; position += 1) {
    if (!removed[position]) continue;
    pixels[position * 4 + 3] = 0;

    const x = position % width;
    const y = Math.floor(position / width);
    if (x > 0 && !removed[position - 1]) edge[position - 1] = 1;
    if (x + 1 < width && !removed[position + 1]) edge[position + 1] = 1;
    if (y > 0 && !removed[position - width]) edge[position - width] = 1;
    if (y + 1 < height && !removed[position + width]) edge[position + width] = 1;
  }

  const secondEdge = new Uint8Array(pixelCount);
  for (let position = 0; position < pixelCount; position += 1) {
    if (!edge[position]) continue;
    pixels[position * 4 + 3] = Math.min(pixels[position * 4 + 3], 150);

    const x = position % width;
    const y = Math.floor(position / width);
    if (x > 0 && !removed[position - 1] && !edge[position - 1]) secondEdge[position - 1] = 1;
    if (x + 1 < width && !removed[position + 1] && !edge[position + 1]) secondEdge[position + 1] = 1;
    if (y > 0 && !removed[position - width] && !edge[position - width]) secondEdge[position - width] = 1;
    if (y + 1 < height && !removed[position + width] && !edge[position + width]) secondEdge[position + width] = 1;
  }

  for (let position = 0; position < pixelCount; position += 1) {
    if (secondEdge[position]) {
      pixels[position * 4 + 3] = Math.min(pixels[position * 4 + 3], 225);
    }
  }

  context.putImageData(imageData, 0, 0);

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let position = 0; position < pixelCount; position += 1) {
    if (pixels[position * 4 + 3] <= 8) continue;
    const x = position % width;
    const y = Math.floor(position / width);
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }

  if (maxX < minX || maxY < minY) {
    throw new Error("The hen image did not contain a visible subject.");
  }

  const padding = Math.max(2, Math.round(Math.min(width, height) * 0.006));
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width - 1, maxX + padding);
  maxY = Math.min(height - 1, maxY + padding);

  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;
  const cropped = document.createElement("canvas");
  cropped.width = cropWidth;
  cropped.height = cropHeight;
  const croppedContext = cropped.getContext("2d");
  if (!croppedContext) throw new Error("Unable to crop the hen image.");
  croppedContext.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

  return {
    dataUrl: cropped.toDataURL("image/png"),
    width: cropWidth,
    height: cropHeight,
  };
}

function drawSoftContactShadow(doc: jsPDF, centerX: number, baseY: number, width: number) {
  doc.saveGraphicsState();
  const shades = [248, 244, 239, 234];
  shades.forEach((shade, index) => {
    const scale = 1 - index * 0.16;
    doc.setFillColor(shade, shade, shade);
    doc.ellipse(centerX, baseY, (width * scale) / 2, 1.35 * scale, "F");
  });
  doc.restoreGraphicsState();
}

function drawHenFallback(doc: jsPDF, x: number, y: number, width: number, height: number) {
  doc.saveGraphicsState();
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  doc.setFillColor(242, 243, 246);
  doc.ellipse(centerX - 1, centerY + 2, width * 0.34, height * 0.28, "F");
  doc.circle(centerX + width * 0.23, centerY - height * 0.2, height * 0.12, "F");
  setFill(doc, RED);
  doc.circle(centerX + width * 0.23, centerY - height * 0.34, height * 0.045, "F");
  doc.setFillColor(218, 160, 62);
  doc.triangle(
    centerX + width * 0.34,
    centerY - height * 0.2,
    centerX + width * 0.46,
    centerY - height * 0.16,
    centerX + width * 0.34,
    centerY - height * 0.12,
    "F"
  );

  doc.restoreGraphicsState();
}

/**
 * Reusable PDF header. It draws only the DMR logo, centered heading/divider and
 * right-side hen, then returns the Y coordinate immediately below the header.
 */
export async function drawDmrPoultryHeader(
  doc: jsPDF,
  options: DmrPoultryHeaderOptions = {}
): Promise<number> {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = options.margin ?? 12;
  const top = options.top ?? 10;
  const title = options.title ?? "DMR POULTRY";
  const subtitle = options.subtitle ?? "";
  const logoSize = 24;

  if (options.logoUrl) {
    try {
      const logo = await prepareLogoImage(options.logoUrl);
      const ratio = Math.min(logoSize / logo.width, logoSize / logo.height);
      const width = logo.width * ratio;
      const height = logo.height * ratio;
      doc.addImage(
        logo.dataUrl,
        "PNG",
        margin + (logoSize - width) / 2,
        top + (logoSize - height) / 2,
        width,
        height,
        undefined,
        "FAST"
      );
    } catch {
      drawDmrLogo(doc, margin, top, logoSize);
    }
  } else {
    drawDmrLogo(doc, margin, top, logoSize);
  }

  const henWidth = 31;
  const henHeight = 29;
  const henX = pageWidth - margin - henWidth;
  const henY = top - 2;
  let henDrawn = false;

  if (options.henUrl) {
    try {
      const hen = await prepareHenCutout(options.henUrl);
      const ratio = Math.min(henWidth / hen.width, henHeight / hen.height);
      const width = hen.width * ratio;
      const height = hen.height * ratio;
      const x = henX + (henWidth - width) / 2;
      const y = henY + henHeight - height;

      drawSoftContactShadow(doc, x + width / 2, y + height - 0.3, width * 0.7);
      doc.addImage(hen.dataUrl, "PNG", x, y, width, height, undefined, "FAST");
      henDrawn = true;
    } catch (error) {
      console.warn("Unable to render the DMR header hen; using the vector fallback.", error);
    }
  }

  if (!henDrawn) drawHenFallback(doc, henX, henY, henWidth, henHeight);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(26);
  setText(doc, NAVY);
  doc.text(title, pageWidth / 2, top + 12.5, { align: "center" });

  if (subtitle) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    setText(doc, RED);
    doc.text(subtitle.toUpperCase(), pageWidth / 2, top + 18.2, {
      align: "center",
      charSpace: 0.7,
    });
  }

  const dividerY = top + 24;
  const dividerHalfWidth = 52;
  setDraw(doc, RED);
  doc.setLineWidth(0.45);
  doc.line(pageWidth / 2 - dividerHalfWidth, dividerY, pageWidth / 2 - 13, dividerY);
  doc.line(pageWidth / 2 + 13, dividerY, pageWidth / 2 + dividerHalfWidth, dividerY);

  setFill(doc, RED);
  doc.circle(pageWidth / 2 - 4, dividerY, 0.65, "F");
  doc.circle(pageWidth / 2, dividerY, 0.85, "F");
  doc.circle(pageWidth / 2 + 4, dividerY, 0.65, "F");

  return Math.max(top + logoSize, henY + henHeight, dividerY) + 3;
}
