// Remembers the last-used "Label Size" per browser, independent of the account-wide
// default in Settings, mirroring the printer/roll "remember last" pattern in
// dymoLabelPrinter.ts. Kept separate from that file since labelType also covers the
// non-DYMO 'brother-dk22211' option.

export type LabelType = 'brother-dk22211' | 'dymo-1933081' | 'dymo-labelmanager';

const LAST_LABEL_TYPE_KEY = 'label.lastLabelType';

export function getLastLabelType(): LabelType | null {
  const value = localStorage.getItem(LAST_LABEL_TYPE_KEY);
  return value === 'brother-dk22211' || value === 'dymo-1933081' || value === 'dymo-labelmanager'
    ? value
    : null;
}

export function setLastLabelType(labelType: LabelType): void {
  localStorage.setItem(LAST_LABEL_TYPE_KEY, labelType);
}
