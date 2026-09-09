import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Printer, Download, Loader2 } from 'lucide-react';
import { api, Asset, LabelSettings } from '../lib/api';
import { printDymoLabel, printDymoTapeLabel, TwinTurboRoll } from '../lib/dymoLabelPrinter';
import { getLastLabelType, setLastLabelType } from '../lib/labelPreferences';
import { useDymoPrinting } from '../hooks/useDymoPrinting';

interface LabelPreviewModalProps {
  asset: Asset;
  onClose: () => void;
}

// Physical label dimensions in mm (width x height), used to keep the preview's
// aspect ratio in sync with whichever label size is selected.
const LABEL_DIMENSIONS_MM: Record<string, { width: number; height: number }> = {
  'brother-dk22211': { width: 62, height: 29 },
  'dymo-1933081': { width: 89, height: 25 },
  'dymo-labelmanager': { width: 51, height: 24 },
};
const PREVIEW_PX_PER_MM = 4.3;

export default function LabelPreviewModal({ asset, onClose }: LabelPreviewModalProps) {
  const [labelOptions, setLabelOptions] = useState<Partial<LabelSettings>>({
    labelType: getLastLabelType() ?? undefined,
    showAssignedTo: true,
    showHostname: true,
    showIpAddress: true,
    qrCodeContent: 'full',
  });
  const [copies, setCopies] = useState(1);

  const { data: orgData } = useQuery({
    queryKey: ['settings', 'organization'],
    queryFn: () => api.getSetting('organization'),
  });

  // Load default settings
  const { data: defaultSettings } = useQuery({
    queryKey: ['labelSettings'],
    queryFn: api.getLabelSettings,
  });

  // Sync label options with default settings when loaded - labelType prefers the
  // browser's remembered last-used value over the account-wide Settings default.
  useEffect(() => {
    if (defaultSettings) {
      setLabelOptions({
        labelType: getLastLabelType() ?? defaultSettings.labelType,
        showAssignedTo: defaultSettings.showAssignedTo,
        showHostname: defaultSettings.showHostname,
        showIpAddress: defaultSettings.showIpAddress,
        qrCodeContent: defaultSettings.qrCodeContent,
      });
    }
  }, [defaultSettings]);

  const printMutation = useMutation({
    mutationFn: () => api.printLabel(asset.id, copies, labelOptions),
    onSuccess: (result) => {
      if (result.success) {
        onClose();
      }
    },
  });

  // Check if a DYMO label type is selected (per-print override, defaults from Settings)
  const isDymo = labelOptions.labelType === 'dymo-1933081' || labelOptions.labelType === 'dymo-labelmanager';
  const isLabelManager = labelOptions.labelType === 'dymo-labelmanager';
  const dymo = useDymoPrinting(isDymo, isLabelManager ? 'tape' : 'labelwriter');

  const dymoPrintMutation = useMutation({
    mutationFn: async () => {
      const { xml } = await api.getDymoLabelXml(asset.id, labelOptions);
      if (isLabelManager) {
        await printDymoTapeLabel(xml, dymo.selectedPrinter, copies);
      } else {
        await printDymoLabel(xml, dymo.selectedPrinter, copies, dymo.isTwinTurbo ? dymo.selectedRoll : undefined);
      }
    },
    onSuccess: () => onClose(),
  });

  const handleDownload = () => {
    const params = new URLSearchParams();
    if (labelOptions.labelType !== undefined) params.set('labelType', labelOptions.labelType);
    if (labelOptions.showAssignedTo !== undefined) params.set('showAssignedTo', String(labelOptions.showAssignedTo));
    if (labelOptions.showHostname !== undefined) params.set('showHostname', String(labelOptions.showHostname));
    if (labelOptions.showIpAddress !== undefined) params.set('showIpAddress', String(labelOptions.showIpAddress));
    if (labelOptions.qrCodeContent !== undefined) params.set('qrCodeContent', labelOptions.qrCodeContent);
    const queryString = params.toString();
    window.open(`${api.downloadLabelUrl(asset.id)}${queryString ? '?' + queryString : ''}`, '_blank');
  };

  const toggleOption = (key: keyof LabelSettings) => {
    setLabelOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLabelTypeChange = (value: 'brother-dk22211' | 'dymo-1933081' | 'dymo-labelmanager') => {
    setLabelOptions(prev => ({ ...prev, labelType: value }));
    setLastLabelType(value);
  };

  const labelDimensionsMm = LABEL_DIMENSIONS_MM[labelOptions.labelType || 'brother-dk22211'];
  const previewWidth = labelDimensionsMm.width * PREVIEW_PX_PER_MM;
  const previewHeight = labelDimensionsMm.height * PREVIEW_PX_PER_MM;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Print Label</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Preview - matches the aspect ratio of the selected label size */}
          <div className="flex justify-center p-4 bg-gray-50 rounded-lg">
            <div
              className="bg-white border border-gray-400 rounded shadow-sm flex flex-col"
              style={{ width: `${previewWidth}px`, minHeight: `${previewHeight}px` }}
            >
              {/* Assigned To - centered at top */}
              {labelOptions.showAssignedTo && (asset.student || asset.assignedTo) && (
                <p className="text-sm font-bold text-center truncate px-2 pt-2">
                  {asset.student
                    ? `${asset.student.prefName || asset.student.firstName} ${asset.student.surname}`
                    : asset.assignedTo}
                </p>
              )}

              {/* Middle section: QR + text */}
              <div className="flex items-center gap-3 px-2 py-1 flex-1">
                <img
                  src={`${api.getLabelPreviewUrl(asset.id)}${labelOptions.labelType ? '?labelType=' + labelOptions.labelType : ''}`}
                  alt="QR Code"
                  className="w-14 h-14 flex-shrink-0"
                />
                <div className="flex-1 min-w-0 overflow-hidden leading-tight">
                  <p className="text-sm font-bold truncate">Item: {asset.itemNumber}</p>
                  {asset.model && (
                    <p className="text-xs font-bold truncate">
                      {asset.manufacturer?.name} {asset.model}
                    </p>
                  )}
                  {asset.serialNumber && (
                    <p className="text-xs font-bold truncate">S/N: {asset.serialNumber}</p>
                  )}
                  {labelOptions.showHostname && asset.hostname && (
                    <p className="text-xs font-bold truncate">{asset.hostname}</p>
                  )}
                  {labelOptions.showIpAddress && asset.ipAddresses && asset.ipAddresses.length > 0 && (
                    <p className="text-xs font-bold truncate">
                      {asset.ipAddresses[0]?.ip}
                    </p>
                  )}
                </div>
              </div>

              {/* Organization Name - centered at bottom */}
              <p className="text-sm font-bold text-gray-800 text-center truncate border-t border-gray-300 py-1 px-2">
                {orgData?.value || 'Organization Name'}
              </p>
            </div>
          </div>

          {/* Label Size - per-print override, doesn't change the saved Settings default */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Label Size</label>
              <select
                value={labelOptions.labelType || 'brother-dk22211'}
                onChange={(e) => handleLabelTypeChange(e.target.value as 'brother-dk22211' | 'dymo-1933081' | 'dymo-labelmanager')}
                className="input"
              >
                <option value="brother-dk22211">Brother DK-22211 (29×62mm)</option>
                <option value="dymo-1933081">Dymo 1933081 (25×89mm)</option>
                <option value="dymo-labelmanager">Dymo 24mm Tape</option>
              </select>
            </div>
            <div>
              <label className="label">Copies</label>
              <input
                type="number"
                min={1}
                value={copies}
                onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value, 10) || 1))}
                className="input"
              />
            </div>
          </div>

          {/* Label Options */}
          <div className="p-3 bg-gray-50 rounded-lg grid grid-cols-2 gap-x-4 gap-y-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={labelOptions.showAssignedTo ?? true}
                onChange={() => toggleOption('showAssignedTo')}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">Show Assigned To</span>
            </label>
            {!isLabelManager && (
              <>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={labelOptions.showHostname ?? true}
                    onChange={() => toggleOption('showHostname')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Show Hostname</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={labelOptions.showIpAddress ?? true}
                    onChange={() => toggleOption('showIpAddress')}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Show IP Address</span>
                </label>
              </>
            )}
          </div>

          {/* DYMO printer selection - detected on this device */}
          {isDymo && dymo.available && (
            <div>
              <label className="label">DYMO Printer (this device)</label>
              <select
                value={dymo.selectedPrinter}
                onChange={(e) => dymo.setSelectedPrinter(e.target.value)}
                className="input"
              >
                {dymo.printers.length === 0 && <option value="">No DYMO printers found</option>}
                {dymo.printers.map((p) => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          {isDymo && dymo.available && dymo.isTwinTurbo && (
            <div>
              <label className="label">Roll (Twin Turbo)</label>
              <select
                value={dymo.selectedRoll}
                onChange={(e) => dymo.setSelectedRoll(e.target.value as TwinTurboRoll)}
                className="input"
              >
                <option value="Auto">Auto</option>
                <option value="Left">Left</option>
                <option value="Right">Right</option>
              </select>
            </div>
          )}
          {isDymo && !dymo.checking && !dymo.available && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
              {dymo.reason || 'DYMO Label Software not detected on this device'} — use Download PDF instead.
            </div>
          )}

          {/* Error message */}
          {printMutation.isError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {printMutation.error instanceof Error ? printMutation.error.message : 'Print failed'}
            </div>
          )}
          {dymoPrintMutation.isError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {dymoPrintMutation.error instanceof Error ? dymoPrintMutation.error.message : 'Print failed'}
            </div>
          )}

          {/* Success message */}
          {printMutation.isSuccess && printMutation.data.success && (
            <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
              {printMutation.data.message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between p-4 border-t bg-gray-50">
          <button
            onClick={handleDownload}
            className="btn btn-secondary"
          >
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            {isDymo ? (
              dymo.checking ? (
                <div className="text-sm text-gray-500 flex items-center px-3">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Checking for DYMO Label Software...
                </div>
              ) : dymo.available ? (
                <button
                  onClick={() => dymoPrintMutation.mutate()}
                  disabled={dymoPrintMutation.isPending || !dymo.selectedPrinter}
                  className="btn btn-primary"
                >
                  {dymoPrintMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Printing...
                    </>
                  ) : (
                    <>
                      <Printer className="w-4 h-4 mr-2" />
                      Print
                    </>
                  )}
                </button>
              ) : (
                <div className="text-sm text-gray-500 flex items-center px-3">
                  Download only
                </div>
              )
            ) : (
              <button
                onClick={() => printMutation.mutate()}
                disabled={printMutation.isPending}
                className="btn btn-primary"
              >
                {printMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Printing...
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4 mr-2" />
                    Print
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
