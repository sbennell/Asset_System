import bwipjs from 'bwip-js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getPrinters } from 'pdf-to-printer';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { exec } from 'child_process';

// DK-22211 label dimensions for Brother QL printers
// For continuous 29mm tape, create landscape PDF and let driver rotate
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
  showAssignedTo: boolean;
  showHostname: boolean;
  showIpAddress: boolean;
  // Note: Item Number, Model, and Serial Number are always shown
}

const DEFAULT_SETTINGS: LabelSettings = {
  printerName: 'Brother QL-500',
  showAssignedTo: true,
  showHostname: true,
  showIpAddress: true,
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
 * Build QR code content with all label info
 */
function buildQRContent(asset: LabelAsset, opts: LabelSettings): string {
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

  // Generate QR code containing all label information
  const qrContent = buildQRContent(asset, opts);
  const qrBuffer = await generateQRCode(qrContent, 150);

  // Create PDF document - landscape orientation (62mm x 29mm)
  const doc = await PDFDocument.create();
  const page = doc.addPage([LABEL_WIDTH_PT, LABEL_HEIGHT_PT]);

  // Embed bold font for all text
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  // Embed QR code image
  const qrImage = await doc.embedPng(qrBuffer);

  // Layout: Landscape - QR on left, text on right
  const margin = 3
  const qrSize = 48; // ~17mm - compact to maximize text space

  // QR code on LEFT, vertically centered on full label height
  const qrX = margin;
  const qrY = (LABEL_HEIGHT_PT - qrSize) / 2;

  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
  });

  // Assigned To name - centered at top of label, auto-fit to fill width
  const topMargin = 12; // Space for assigned to name at top
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

    page.drawText(assignedText, {
      x: (LABEL_WIDTH_PT - assignedWidth) / 2,
      y: LABEL_HEIGHT_PT - topMargin,
      size: assignedFontSize,
      font: boldFont,
      color: rgb(0, 0, 0),
    });
  }

  // Text starts after QR code
  const textX = qrX + qrSize + 2;
  let textY = LABEL_HEIGHT_PT - 24; // Start below the assigned to name

  // Text styling
  const fontSize = 8;
  const boldFontSize = 9;
  const lineHeight = 10;
  const textAreaWidth = LABEL_WIDTH_PT - textX - margin; // Available width for text

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
    const availableWidth = LABEL_WIDTH_PT - (margin * 2);
    const maxFontSize = 14;
    const minFontSize = 6;

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
      y: 4,
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
  // For preview, we'll return the QR code with asset info encoded
  // A more sophisticated implementation could render the full label as an image
  const qrBuffer = await generateQRCode(asset.itemNumber, 200);
  return qrBuffer;
}

/**
 * Print a label to the specified printer using PowerShell
 */
export async function printLabel(
  pdfBytes: Uint8Array,
  printerName: string
): Promise<void> {
  // Write PDF to temp file
  const tempPath = join(tmpdir(), `label-${Date.now()}.pdf`);
  writeFileSync(tempPath, Buffer.from(pdfBytes));

  try {
    await new Promise<void>((resolve, reject) => {
      const escapedPath = tempPath.replace(/\\/g, '/');
      const escapedPrinter = printerName.replace(/'/g, "''");

      // Simple PowerShell command to print using default PDF handler
      const cmd = `powershell -NoProfile -Command "Start-Process -FilePath '${escapedPath}' -Verb Print"`;

      exec(cmd, { timeout: 30000 }, (error) => {
        if (error) {
          // Try with PrintTo verb and printer name
          const cmd2 = `powershell -NoProfile -Command "Start-Process -FilePath '${escapedPath}' -Verb PrintTo -ArgumentList '${escapedPrinter}'"`;
          exec(cmd2, { timeout: 30000 }, (err2) => {
            if (err2) {
              reject(new Error(`Print failed: ${err2.message}`));
            } else {
              resolve();
            }
          });
        } else {
          resolve();
        }
      });
    });
  } finally {
    // Clean up temp file after a delay to allow printing to complete
    setTimeout(() => {
      try {
        unlinkSync(tempPath);
      } catch (e) {
        // Ignore cleanup errors
      }
    }, 10000);
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
    showAssignedTo: get('label.showAssignedTo') !== 'false',
    showHostname: get('label.showHostname') !== 'false',
    showIpAddress: get('label.showIpAddress') !== 'false',
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
  if (settings.showAssignedTo !== undefined) {
    result['label.showAssignedTo'] = String(settings.showAssignedTo);
  }
  if (settings.showHostname !== undefined) {
    result['label.showHostname'] = String(settings.showHostname);
  }
  if (settings.showIpAddress !== undefined) {
    result['label.showIpAddress'] = String(settings.showIpAddress);
  }

  return result;
}
