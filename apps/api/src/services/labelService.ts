import bwipjs from 'bwip-js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getPrinters, print } from 'pdf-to-printer';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// DK-22211 label dimensions for Brother QL label printers
// For continuous 29mm tape, create landscape PDF and let printer driver rotate
// Width = print length (62mm), Height = tape width (29mm)
const LABEL_WIDTH_PT = 176;  // 62mm (print length along tape)
const LABEL_HEIGHT_PT = 82;  // 29mm (tape width)

export interface LabelAsset {
  itemNumber: string;
  serialNumber?: string | null;
  model?: string | null;
  hostname?: string | null;
  ipAddress?: string | null;
  assignedTo?: string | null;
  manufacturer?: { name: string } | null;
  organizationName?: string | null;
}

export interface LabelSettings {
  printerName: string;
  labelType: 'brother-dk22211' | 'brother-dk22211-bordered' | 'dymo-1933081' | 'dymo-labelmanager';
  showAssignedTo: boolean;
  showHostname: boolean;
  showIpAddress: boolean;
  qrCodeContent: 'full' | 'itemNumber';
  // Note: Item Number, Model, and Serial Number are always shown
}

const DEFAULT_SETTINGS: LabelSettings = {
  printerName: '',
  labelType: 'brother-dk22211',
  showAssignedTo: true,
  showHostname: true,
  showIpAddress: true,
  qrCodeContent: 'full',
};

/**
 * Generate a QR code as PNG buffer
 */
export async function generateQRCode(text: string, size: number = 150): Promise<Buffer> {
  const png = await bwipjs.toBuffer({
    bcid: 'qrcode',
    text: text,
    scale: 3,
    width: Math.floor(size / 10),
    height: Math.floor(size / 10),
  } as bwipjs.RenderOptions);
  return png;
}

/**
 * Generate a Code128 barcode as PNG buffer
 */
export async function generateBarcode(text: string): Promise<Buffer> {
  const png = await bwipjs.toBuffer({
    bcid: 'code128',
    text: text,
    scale: 2,
    height: 8,
    includetext: false,
  } as bwipjs.RenderOptions);
  return png;
}

/**
 * Build QR code content based on qrCodeContent setting
 */
function buildQRContent(asset: LabelAsset, opts: LabelSettings): string {
  // If qrCodeContent is set to itemNumber, return only the item number
  if (opts.qrCodeContent === 'itemNumber') {
    return asset.itemNumber;
  }

  // Otherwise, build full QR content with all label info
  const lines: string[] = [];

  if (opts.showAssignedTo && asset.assignedTo) {
    lines.push(asset.assignedTo);
  }
  lines.push(`Item: ${asset.itemNumber}`);
  // Model is always included
  if (asset.model) {
    const modelText = asset.manufacturer?.name
      ? `${asset.manufacturer.name} ${asset.model}`
      : asset.model;
    lines.push(modelText);
  }
  // Serial Number is always included (under Model)
  if (asset.serialNumber) {
    lines.push(`S/N: ${asset.serialNumber}`);
  }
  // Hostname and IP on separate lines
  if (opts.showHostname && asset.hostname) {
    lines.push(asset.hostname);
  }
  if (opts.showIpAddress && asset.ipAddress) {
    lines.push(asset.ipAddress);
  }
  if (asset.organizationName) {
    lines.push(asset.organizationName);
  }

  return lines.join('\n');
}

/**
 * Create a label PDF for an asset
 * Landscape PDF (62mm x 29mm) with QR on left, text on right
 * Brother QL driver handles rotation for 29mm tape
 */
export async function createLabelPDF(
  asset: LabelAsset,
  settings: Partial<LabelSettings> = {}
): Promise<Uint8Array> {
  const opts = { ...DEFAULT_SETTINGS, ...settings };
  const isBordered = opts.labelType === 'brother-dk22211-bordered';
  const MM_TO_PT = 72 / 25.4;
  const borderInset = 2;
  // Org name (and the divider above it) is nudged up off the border line - shared here so
  // the QR/text vertical divider below can reach down to that same divider line.
  const orgDividerY = 16 + (isBordered ? MM_TO_PT : 0);

  // Generate QR code containing all label information
  const qrContent = buildQRContent(asset, opts);
  const qrBuffer = await generateQRCode(qrContent, 150);

  // Create PDF document - landscape orientation (62mm x 29mm)
  const doc = await PDFDocument.create();
  const page = doc.addPage([LABEL_WIDTH_PT, LABEL_HEIGHT_PT]);

  // 'brother-dk22211-bordered' is identical to the plain DK-22211 label except for this
  // outline, matching the visible border added to the Dymo 24mm Tape label.
  if (isBordered) {
    page.drawRectangle({
      x: borderInset,
      y: borderInset,
      width: LABEL_WIDTH_PT - borderInset * 2,
      height: LABEL_HEIGHT_PT - borderInset * 2,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1.5,
    });
  }

  // Embed bold font for all text
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  // Embed QR code image
  const qrImage = await doc.embedPng(qrBuffer);

  // Layout: Landscape - QR on left, text on right
  const margin = 3;
  const qrSize = 48; // ~17mm - compact to maximize text space

  // QR code on LEFT, vertically centered on full label height. Bordered variant nudges
  // the QR up by 3mm and right by 0.5mm to better center it within the border.
  const qrX = margin + (isBordered ? 0.5 * MM_TO_PT : 0);
  const qrY = (LABEL_HEIGHT_PT - qrSize) / 2 + (isBordered ? 3 * MM_TO_PT : 0);

  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
  });

  // Bordered variant gets a vertical divider between the QR and the text block, matching
  // the vertical divider between those two areas on the Dymo 24mm Tape label. Runs from
  // the top border down to the horizontal divider above the org name.
  if (isBordered) {
    const dividerX = qrX + qrSize + MM_TO_PT;
    page.drawLine({
      start: { x: dividerX, y: LABEL_HEIGHT_PT - borderInset },
      end: { x: dividerX, y: orgDividerY },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
  }

  // Assigned To name - centered at top of label, auto-fit to fill width
  const topMargin = 12; // Space from top for assigned to name
  if (opts.showAssignedTo && asset.assignedTo) {
    const assignedText = asset.assignedTo;
    const availableWidth = LABEL_WIDTH_PT - (margin * 2);
    const maxAssignedFontSize = 14;
    const minAssignedFontSize = 7;

    // Calculate font size to fit text within available width
    let assignedFontSize = maxAssignedFontSize;
    let assignedWidth = boldFont.widthOfTextAtSize(assignedText, assignedFontSize);

    // Scale down if text is too wide
    if (assignedWidth > availableWidth) {
      assignedFontSize = Math.max(minAssignedFontSize, (availableWidth / assignedWidth) * maxAssignedFontSize);
      assignedWidth = boldFont.widthOfTextAtSize(assignedText, assignedFontSize);
    }

    // Bordered variant nudges the Assigned To text down 1mm total - it was still
    // touching the top border.
    page.drawText(assignedText, {
      x: (LABEL_WIDTH_PT - assignedWidth) / 2,
      y: LABEL_HEIGHT_PT - topMargin - (isBordered ? MM_TO_PT : 0),
      size: assignedFontSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
  }

  // Text starts after QR code. Bordered variant nudges it right by 1mm to clear the
  // vertical divider.
  const textX = qrX + qrSize + 2 + (isBordered ? MM_TO_PT : 0);
  // Start below the assigned to name. Bordered variant adds another 0.5mm of clearance
  // from the top border on top of the existing margin.
  let textY = LABEL_HEIGHT_PT - 24 - (isBordered ? 0.5 * MM_TO_PT : 0);
  const detailStartY = textY;

  // Text styling
  const fontSize = 8;
  const boldFontSize = 9;
  // Bordered variant keeps the last detail line at least 0.5mm clear of whatever's below
  // it (the org-name divider, or the bottom border if there's no org name), compressing
  // line spacing only as much as the worst-case (all optional fields shown) requires.
  const lineCount = 1 + (asset.model ? 1 : 0) + (asset.serialNumber ? 1 : 0)
    + (opts.showHostname && asset.hostname ? 1 : 0) + (opts.showIpAddress && asset.ipAddress ? 1 : 0);
  const detailBottomLimit = isBordered
    ? (asset.organizationName ? orgDividerY : borderInset) + 0.5 * MM_TO_PT
    : -Infinity;
  const lineHeight = isBordered && lineCount > 1
    ? Math.min(10, (detailStartY - detailBottomLimit) / (lineCount - 1))
    : 10;
  // Bordered variant keeps the detail text at least 0.5mm clear of the right border.
  const textAreaWidth = LABEL_WIDTH_PT - textX - (isBordered ? borderInset + 0.5 * MM_TO_PT : margin);

  // Item Number with prefix - bold and larger
  page.drawText(truncateText(`Item: ${asset.itemNumber}`, 28), {
    x: textX,
    y: textY,
    size: boldFontSize,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  textY -= lineHeight;

  // Model (always shown) - auto-fit to available width
  if (asset.model) {
    const modelText = asset.manufacturer?.name
      ? `${asset.manufacturer.name} ${asset.model}`
      : asset.model;
    const maxModelFontSize = 8;
    const minModelFontSize = 5;

    // Calculate font size to fit text within available width
    let modelFontSize = maxModelFontSize;
    let modelWidth = boldFont.widthOfTextAtSize(modelText, modelFontSize);

    // Scale down if text is too wide
    if (modelWidth > textAreaWidth) {
      modelFontSize = Math.max(minModelFontSize, (textAreaWidth / modelWidth) * maxModelFontSize);
    }

    page.drawText(modelText, {
      x: textX,
      y: textY,
      size: modelFontSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    textY -= lineHeight;
  }

  // Serial Number (always shown, under Model)
  if (asset.serialNumber) {
    page.drawText(truncateText(`S/N: ${asset.serialNumber}`, 30), {
      x: textX,
      y: textY,
      size: fontSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    textY -= lineHeight;
  }

  // Hostname on its own line
  if (opts.showHostname && asset.hostname) {
    page.drawText(truncateText(asset.hostname, 30), {
      x: textX,
      y: textY,
      size: fontSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
    textY -= lineHeight;
  }

  // IP Address on its own line
  if (opts.showIpAddress && asset.ipAddress) {
    page.drawText(truncateText(asset.ipAddress, 30), {
      x: textX,
      y: textY,
      size: fontSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
  }

  // Organization Name - centered at bottom, auto-fit to fill width
  if (asset.organizationName) {
    const orgText = asset.organizationName;
    // Bordered variant keeps the org text at least 0.5mm clear of the left/right border.
    const availableWidth = isBordered
      ? LABEL_WIDTH_PT - (borderInset + 0.5 * MM_TO_PT) * 2
      : LABEL_WIDTH_PT - (margin * 2);
    const maxFontSize = 14;
    const minFontSize = 6;

    // Bordered variant nudges the org name up off the border line.
    const orgY = 4 + (isBordered ? MM_TO_PT : 0);

    // Bordered variant gets a divider line above the org name, matching the horizontal
    // rule above the org-name row on the Dymo 24mm Tape label. Runs edge-to-edge between
    // the left/right border, same as the vertical QR/text divider reaches the top border.
    if (isBordered) {
      page.drawLine({
        start: { x: borderInset, y: orgDividerY },
        end: { x: LABEL_WIDTH_PT - borderInset, y: orgDividerY },
        thickness: 1,
        color: rgb(0, 0, 0),
      });
    }

    // Calculate font size to fit text within available width
    let orgFontSize = maxFontSize;
    let orgWidth = boldFont.widthOfTextAtSize(orgText, orgFontSize);

    // Scale down if text is too wide
    if (orgWidth > availableWidth) {
      orgFontSize = Math.max(minFontSize, (availableWidth / orgWidth) * maxFontSize);
      orgWidth = boldFont.widthOfTextAtSize(orgText, orgFontSize);
    }

    page.drawText(orgText, {
      x: (LABEL_WIDTH_PT - orgWidth) / 2,
      y: orgY,
      size: orgFontSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
  }

  return doc.save();
}

/**
 * Create a label preview as PNG image
 */
export async function createLabelPreview(
  asset: LabelAsset,
  settings: Partial<LabelSettings> = {}
): Promise<Buffer> {
  const opts = { ...DEFAULT_SETTINGS, ...settings };
  // Return the QR code with full content (includes assignedTo if enabled)
  const qrContent = buildQRContent(asset, opts);
  const qrBuffer = await generateQRCode(qrContent, 200);
  return qrBuffer;
}

// Stocktake condition values, matching the frontend's CONDITION_LABELS (apps/web/src/lib/utils.ts),
// plus a leading "NONE" entry that clears any locked condition (mirrors the "No Change" button)
const CONDITION_LABELS: [value: string, label: string][] = [
  ['NONE', 'No Change'],
  ['NEW', 'New'],
  ['EXCELLENT', 'Excellent'],
  ['GOOD', 'Good'],
  ['FAIR', 'Fair'],
  ['POOR', 'Poor'],
  ['NON_FUNCTIONAL', 'Non-Functional'],
];

/**
 * Create an A4 sheet of scannable condition QR codes (CONDITION:GOOD, etc.)
 * for use with the Stocktake Quick Verify "Continuous" condition mode.
 */
export async function createConditionSheetPDF(): Promise<Uint8Array> {
  const PAGE_WIDTH = 595.28; // A4 portrait, points
  const PAGE_HEIGHT = 841.89;
  const MARGIN = 36;
  const COLS = 2;
  const ROWS = 4;

  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await doc.embedFont(StandardFonts.Helvetica);

  // Title
  const title = 'Stocktake Condition Barcodes';
  const titleSize = 16;
  const titleWidth = boldFont.widthOfTextAtSize(title, titleSize);
  page.drawText(title, {
    x: (PAGE_WIDTH - titleWidth) / 2,
    y: PAGE_HEIGHT - MARGIN,
    size: titleSize,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  const subtitle = 'Scan a code to lock that condition, then scan assets to apply it in Quick Verify. Scan "No Change" to clear the lock.';
  const subtitleSize = 9;
  const subtitleWidth = regularFont.widthOfTextAtSize(subtitle, subtitleSize);
  page.drawText(subtitle, {
    x: (PAGE_WIDTH - subtitleWidth) / 2,
    y: PAGE_HEIGHT - MARGIN - 16,
    size: subtitleSize,
    font: regularFont,
    color: rgb(0.35, 0.35, 0.35),
  });

  const gridTop = PAGE_HEIGHT - MARGIN - 40;
  const gridBottom = MARGIN;
  const cellWidth = (PAGE_WIDTH - MARGIN * 2) / COLS;
  const cellHeight = (gridTop - gridBottom) / ROWS;
  const qrSize = Math.min(cellWidth, cellHeight) - 70;

  for (let i = 0; i < CONDITION_LABELS.length; i++) {
    const [value, label] = CONDITION_LABELS[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);

    const cellX = MARGIN + col * cellWidth;
    const cellTopY = gridTop - row * cellHeight;
    const cellBottomY = cellTopY - cellHeight;

    // Dashed cut border around the cell
    page.drawRectangle({
      x: cellX + 6,
      y: cellBottomY + 6,
      width: cellWidth - 12,
      height: cellHeight - 12,
      borderColor: rgb(0.7, 0.7, 0.7),
      borderWidth: 1,
      borderDashArray: [4, 4],
    });

    const qrBuffer = await generateQRCode(`CONDITION:${value}`, 300);
    const qrImage = await doc.embedPng(qrBuffer);
    const qrX = cellX + (cellWidth - qrSize) / 2;
    const qrY = cellBottomY + (cellHeight - qrSize) / 2 - 6;
    page.drawImage(qrImage, { x: qrX, y: qrY, width: qrSize, height: qrSize });

    const labelSize = 15;
    const labelWidth = boldFont.widthOfTextAtSize(label, labelSize);
    page.drawText(label, {
      x: cellX + (cellWidth - labelWidth) / 2,
      y: qrY + qrSize + 14,
      size: labelSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
  }

  return doc.save();
}

/**
 * Print a label to the specified printer using pdf-to-printer
 * Works in service context (SYSTEM user) where PowerShell verb methods fail
 */
export async function printLabel(
  pdfBytes: Uint8Array,
  printerName: string
): Promise<void> {
  // Write PDF to temp file
  const tempPath = join(tmpdir(), `label-${Date.now()}.pdf`);
  writeFileSync(tempPath, Buffer.from(pdfBytes));

  try {
    // Use pdf-to-printer which works in SYSTEM user context (service)
    // Set paper size to match DK-22211 and use 'fit' scale to fill the label
    const printOptions: any = {
      paperSize: '29x62mm',
      orientation: 'landscape',
      scale: 'fit',
    };

    if (printerName) {
      printOptions.printer = printerName;
    }

    await print(tempPath, printOptions);
  } finally {
    // Clean up temp file after a delay to allow printing to complete
    setTimeout(() => {
      try {
        unlinkSync(tempPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }, 2000);
  }
}

/**
 * Get list of available printers
 */
export async function getAvailablePrinters(): Promise<string[]> {
  try {
    const printers = await getPrinters();
    return printers.map(p => p.name);
  } catch (error) {
    console.error('Failed to get printers:', error);
    return [];
  }
}

/**
 * Truncate text to fit within label width
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 2) + '..';
}

/**
 * Parse settings from key-value store format
 */
export function parseSettings(
  settingsMap: Map<string, string> | Record<string, string>
): LabelSettings {
  const get = (key: string) => {
    if (settingsMap instanceof Map) {
      return settingsMap.get(key);
    }
    return settingsMap[key];
  };

  return {
    printerName: get('label.printerName') || DEFAULT_SETTINGS.printerName,
    labelType: (['brother-dk22211-bordered', 'dymo-1933081', 'dymo-labelmanager'].includes(get('label.labelType') || '')
      ? get('label.labelType') as 'brother-dk22211-bordered' | 'dymo-1933081' | 'dymo-labelmanager'
      : 'brother-dk22211'),
    showAssignedTo: get('label.showAssignedTo') !== 'false',
    showHostname: get('label.showHostname') !== 'false',
    showIpAddress: get('label.showIpAddress') !== 'false',
    qrCodeContent: (get('label.qrCodeContent') === 'itemNumber' ? 'itemNumber' : 'full'),
  };
}

/**
 * Convert settings to key-value pairs for storage
 */
export function settingsToKeyValue(settings: Partial<LabelSettings>): Record<string, string> {
  const result: Record<string, string> = {};

  if (settings.printerName !== undefined) {
    result['label.printerName'] = settings.printerName;
  }
  if (settings.labelType !== undefined) {
    result['label.labelType'] = settings.labelType;
  }
  if (settings.showAssignedTo !== undefined) {
    result['label.showAssignedTo'] = String(settings.showAssignedTo);
  }
  if (settings.showHostname !== undefined) {
    result['label.showHostname'] = String(settings.showHostname);
  }
  if (settings.showIpAddress !== undefined) {
    result['label.showIpAddress'] = String(settings.showIpAddress);
  }
  if (settings.qrCodeContent !== undefined) {
    result['label.qrCodeContent'] = settings.qrCodeContent;
  }

  return result;
}
