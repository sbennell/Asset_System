import { useEffect, useState } from 'react';
import {
  checkDymoAvailable,
  DymoPrinterSummary,
  getLastDymoPrinter,
  getLastDymoRoll,
  getLastDymoTapePrinter,
  listDymoPrinters,
  listDymoTapePrinters,
  setLastDymoPrinter,
  setLastDymoRoll,
  setLastDymoTapePrinter,
  TwinTurboRoll,
} from '../lib/dymoLabelPrinter';

export type DymoPrinterFamily = 'labelwriter' | 'tape';

/**
 * Detects DYMO Label Software running on the current device (browser-local, per
 * machine) and lists its printers. Only runs the detection while `enabled` is true,
 * so it's cheap to mount in modals that aren't currently showing a DYMO label.
 * `family` selects between die-cut LabelWriter printers and Tape printers (e.g. the
 * LabelManager Executive 640), which DYMO Connect exposes via separate APIs.
 */
export function useDymoPrinting(enabled: boolean, family: DymoPrinterFamily = 'labelwriter') {
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(false);
  const [reason, setReason] = useState<string | undefined>();
  const [printers, setPrinters] = useState<DymoPrinterSummary[]>([]);
  const [selectedPrinter, setSelectedPrinterState] = useState('');
  const [selectedRoll, setSelectedRollState] = useState<TwinTurboRoll>('Auto');

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setChecking(true);
    const listPrinters = family === 'tape' ? listDymoTapePrinters : listDymoPrinters;
    const getLastPrinter = family === 'tape' ? getLastDymoTapePrinter : getLastDymoPrinter;

    (async () => {
      const result = await checkDymoAvailable();
      if (cancelled) return;
      setAvailable(result.available);
      setReason(result.reason);

      if (result.available) {
        const list = await listPrinters();
        if (cancelled) return;
        setPrinters(list);
        const last = getLastPrinter();
        setSelectedPrinterState(last && list.some((p) => p.name === last) ? last : (list[0]?.name || ''));
        setSelectedRollState(getLastDymoRoll());
      }

      setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, family]);

  const setSelectedPrinter = (name: string) => {
    setSelectedPrinterState(name);
    (family === 'tape' ? setLastDymoTapePrinter : setLastDymoPrinter)(name);
  };

  const setSelectedRoll = (roll: TwinTurboRoll) => {
    setSelectedRollState(roll);
    setLastDymoRoll(roll);
  };

  const isTwinTurbo = printers.find((p) => p.name === selectedPrinter)?.isTwinTurbo ?? false;

  return {
    checking,
    available,
    reason,
    printers,
    selectedPrinter,
    setSelectedPrinter,
    isTwinTurbo,
    selectedRoll,
    setSelectedRoll,
  };
}
