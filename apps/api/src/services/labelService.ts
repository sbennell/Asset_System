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
  manufacturer?: { name: string } | null;
  organizationName?: string | null;
}

export interface LabelSettings {
  printerName: string;
  showModel: boolean;
  showHostname: boolean;
  showSerialNumber: boolean;
}

const DEFAULT_SETTINGS: LabelSettings = {
  printerName: 'Brother QL-500',
  showModel: true,
  showHostname: true,
  showSerialNumber: true,
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
 * Create a label PDF for an asset
 * Landscape PDF (62mm x 29mm) with QR on left, text on right
 * Brother QL driver handles rotation for 29mm tape
 */
export async function createLabelPDF(
  asset: LabelAsset,
  settings: Partial<LabelSettings> = {}
): Promise<Uint8Array> {
  const opts = { ...DEFAULT_SETTINGS, ...settings };

  // Generate QR code containing the item number
  const qrBuffer = await generateQRCode(asset.itemNumber, 150);

  // Create PDF document - landscape orientation (62mm x 29mm)
  const doc = await PDFDocument.create();
  const page = doc.addPage([LABEL_WIDTH_PT, LABEL_HEIGHT_PT]);

  // Embed fonts
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await doc.embedFont(StandardFonts.Helvetica);

  // Embed QR code image
  const qrImage = await doc.embedPng(qrBuffer);

  // Layout: Landscape - QR on left, text on right
  const margin = 4;
  const qrSize = 48; // ~17mm - compact to maximize text space
  const bottomMargin = 14; // Space for organization name

  // QR code on LEFT, vertically centered above org name line
  const qrX = margin;
  const qrY = bottomMargin + (LABEL_HEIGHT_PT - bottomMargin - qrSize) / 2;

  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSize,
    height: qrSize,
  });

  // Text starts after QR code
  const textX = qrX + qrSize + 6;
  let textY = LABEL_HEIGHT_PT - 14;

  // Item Number (bold, larger)
  page.drawText(truncateText(asset.itemNumber, 18), {
    x: textX,
    y: textY,
    size: 11,
    font: boldFont,
    color: rgb(0, 0, 0),
  });
  textY -= 14;

  // Model (with manufacturer if available)
  if (opts.showModel && asset.model) {
    const modelText = asset.manufacturer?.name
      ? `${asset.manufacturer.name} ${asset.model}`
      : asset.model;
    page.drawText(truncateText(modelText, 22), {
      x: textX,
      y: textY,
      size: 8,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
    textY -= 11;
  }

  // Hostname
  if (opts.showHostname && asset.hostname) {
    page.drawText(truncateText(asset.hostname, 22), {
      x: textX,
      y: textY,
      size: 8,
      font: regularFont,
      color: rgb(0, 0, 0),
    });
    textY -= 11;
  }

  // Serial Number
  if (opts.showSerialNumber && asset.serialNumber) {
    page.drawText(truncateText(`SN: ${asset.serialNumber}`, 24), {
      x: textX,
      y: textY,
      size: 7,
      font: regularFont,
      color: rgb(0.3, 0.3, 0.3),
    });
  }

  // Organization Name - centered at bottom, full width
  if (asset.organizationName) {
    const orgText = truncateText(asset.organizationName, 38);
    const orgWidth = regularFont.widthOfTextAtSize(orgText, 8);
    page.drawText(orgText, {
      x: (LABEL_WIDTH_PT - orgWidth) / 2,
      y: 4,
      size: 8,
      font: regularFont,
      color: rgb(0.3, 0.3, 0.3),
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
    showModel: get('label.showModel') !== 'false',
    showHostname: get('label.showHostname') !== 'false',
    showSerialNumber: get('label.showSerialNumber') !== 'false',
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
  if (settings.showModel !== undefined) {
    result['label.showModel'] = String(settings.showModel);
  }
  if (settings.showHostname !== undefined) {
    result['label.showHostname'] = String(settings.showHostname);
  }
  if (settings.showSerialNumber !== undefined) {
    result['label.showSerialNumber'] = String(settings.showSerialNumber);
  }

  return result;
}
