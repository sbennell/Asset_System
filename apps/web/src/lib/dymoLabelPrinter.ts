// Thin wrapper around DYMO's official `dymo.connect.framework.js` SDK (vendored at
// /vendor/dymo.connect.framework.js), which talks to DYMO Label Software's local web
// service on the user's own machine (127.0.0.1:41951). This must run in the browser —
// the backend server has no access to a printer attached to someone else's PC.

export type TwinTurboRoll = 'Auto' | 'Left' | 'Right';

interface DymoPrinterInfo {
  name: string;
  printerType: string;
  isTwinTurbo: boolean;
}

export interface DymoPrinterSummary {
  name: string;
  isTwinTurbo: boolean;
}

interface DymoCheckEnvironmentResult {
  isBrowserSupported: boolean;
  isFrameworkInstalled: boolean;
  isWebServicePresent: boolean;
}

interface DymoTapePrinterInfo {
  name: string;
  printerType: string;
  isAutoCutSupported: boolean;
}

interface DymoFramework {
  checkEnvironment(onSuccess: (result: DymoCheckEnvironmentResult) => void, onError?: (error: unknown) => void): void;
  getLabelWriterPrintersAsync(): Promise<DymoPrinterInfo[]>;
  createLabelWriterPrintParamsXml(params: { copies?: number; flowDirection?: string; twinTurboRoll?: TwinTurboRoll }): string;
  // LabelManager Executive 640 and other D1-tape devices are exposed as "Tape" printers
  // by DYMO Connect Framework, separate from the die-cut "LabelWriter" printer family.
  getTapePrintersAsync(): Promise<DymoTapePrinterInfo[]>;
  createTapePrintParamsXml(params: { copies?: number; cutMode?: 'Auto' | 'None' }): string;
  printLabelAsync(printerName: string, printParamsXml: string, labelXml: string, labelSetXml: string): Promise<void>;
}

declare global {
  interface Window {
    dymo?: { label: { framework: DymoFramework } };
  }
}

const SDK_URL = '/vendor/dymo.connect.framework.js';
const LAST_PRINTER_KEY = 'dymo.lastPrinterName';
const LAST_ROLL_KEY = 'dymo.lastRoll';
const LAST_TAPE_PRINTER_KEY = 'dymo.lastTapePrinterName';

let sdkLoadPromise: Promise<void> | null = null;

export function loadDymoSdk(): Promise<void> {
  if (window.dymo?.label?.framework) {
    return Promise.resolve();
  }
  if (!sdkLoadPromise) {
    sdkLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SDK_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load DYMO SDK script'));
      document.head.appendChild(script);
    });
  }
  return sdkLoadPromise;
}

export interface DymoAvailability {
  available: boolean;
  reason?: string;
}

export async function checkDymoAvailable(): Promise<DymoAvailability> {
  try {
    await loadDymoSdk();
  } catch {
    return { available: false, reason: 'Could not load the DYMO print component' };
  }

  const framework = window.dymo?.label?.framework;
  if (!framework) {
    return { available: false, reason: 'DYMO SDK failed to initialize' };
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve({ available: false, reason: 'DYMO Label Software did not respond (is it running?)' });
    }, 4000);

    try {
      framework.checkEnvironment((result) => {
        clearTimeout(timeout);
        if (!result.isFrameworkInstalled) {
          resolve({ available: false, reason: 'DYMO Label Software is not installed on this device' });
        } else if (!result.isWebServicePresent) {
          resolve({ available: false, reason: 'DYMO Label Software is installed but not running' });
        } else if (!result.isBrowserSupported) {
          resolve({ available: false, reason: 'This browser is not supported by DYMO Label Software' });
        } else {
          resolve({ available: true });
        }
      }, () => {
        clearTimeout(timeout);
        resolve({ available: false, reason: 'DYMO Label Software not detected on this device' });
      });
    } catch {
      clearTimeout(timeout);
      resolve({ available: false, reason: 'DYMO Label Software not detected on this device' });
    }
  });
}

export async function listDymoPrinters(): Promise<DymoPrinterSummary[]> {
  const framework = window.dymo?.label?.framework;
  if (!framework) return [];
  const printers = await framework.getLabelWriterPrintersAsync();
  return printers.map((p) => ({ name: p.name, isTwinTurbo: p.isTwinTurbo }));
}

/** Lists Tape printers (e.g. the LabelManager Executive 640), separate from LabelWriters. */
export async function listDymoTapePrinters(): Promise<DymoPrinterSummary[]> {
  const framework = window.dymo?.label?.framework;
  if (!framework) return [];
  const printers = await framework.getTapePrintersAsync();
  return printers.map((p) => ({ name: p.name, isTwinTurbo: false }));
}

/**
 * @param twinTurboRoll Which roll to use on a LabelWriter 450 Twin Turbo (or similar
 * dual-roll printer). Ignored for single-roll printers.
 */
export async function printDymoLabel(
  xml: string,
  printerName: string,
  copies = 1,
  twinTurboRoll?: TwinTurboRoll
): Promise<void> {
  const framework = window.dymo?.label?.framework;
  if (!framework) {
    throw new Error('DYMO SDK is not loaded');
  }
  const printParamsXml = framework.createLabelWriterPrintParamsXml({
    copies,
    flowDirection: 'LeftToRight',
    ...(twinTurboRoll ? { twinTurboRoll } : {}),
  });
  await framework.printLabelAsync(printerName, printParamsXml, xml, '');
}

/** Prints to a Tape printer (e.g. the LabelManager Executive 640), auto-cutting each copy. */
export async function printDymoTapeLabel(xml: string, printerName: string, copies = 1): Promise<void> {
  const framework = window.dymo?.label?.framework;
  if (!framework) {
    throw new Error('DYMO SDK is not loaded');
  }
  const printParamsXml = framework.createTapePrintParamsXml({ copies, cutMode: 'Auto' });
  await framework.printLabelAsync(printerName, printParamsXml, xml, '');
}

export function getLastDymoPrinter(): string {
  return localStorage.getItem(LAST_PRINTER_KEY) || '';
}

export function setLastDymoPrinter(printerName: string): void {
  localStorage.setItem(LAST_PRINTER_KEY, printerName);
}

export function getLastDymoRoll(): TwinTurboRoll {
  const value = localStorage.getItem(LAST_ROLL_KEY);
  return value === 'Left' || value === 'Right' ? value : 'Auto';
}

export function setLastDymoRoll(roll: TwinTurboRoll): void {
  localStorage.setItem(LAST_ROLL_KEY, roll);
}

export function getLastDymoTapePrinter(): string {
  return localStorage.getItem(LAST_TAPE_PRINTER_KEY) || '';
}

export function setLastDymoTapePrinter(printerName: string): void {
  localStorage.setItem(LAST_TAPE_PRINTER_KEY, printerName);
}
