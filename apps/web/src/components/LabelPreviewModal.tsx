import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Printer, Download, Loader2, Settings } from 'lucide-react';
import { api, Asset, LabelSettings } from '../lib/api';

interface LabelPreviewModalProps {
  asset: Asset;
  onClose: () => void;
}

export default function LabelPreviewModal({ asset, onClose }: LabelPreviewModalProps) {
  const [showOptions, setShowOptions] = useState(false);
  const [labelOptions, setLabelOptions] = useState<Partial<LabelSettings>>({
    showAssignedTo: true,
    showHostname: true,
    showIpAddress: true,
  });

  const { data: orgData } = useQuery({
    queryKey: ['settings', 'organization'],
    queryFn: () => api.getSetting('organization'),
  });

  // Load default settings
  const { data: defaultSettings } = useQuery({
    queryKey: ['labelSettings'],
    queryFn: api.getLabelSettings,
  });

  // Sync label options with default settings when loaded
  useEffect(() => {
    if (defaultSettings) {
      setLabelOptions({
        showAssignedTo: defaultSettings.showAssignedTo,
        showHostname: defaultSettings.showHostname,
        showIpAddress: defaultSettings.showIpAddress,
      });
    }
  }, [defaultSettings]);

  const printMutation = useMutation({
    mutationFn: () => api.printLabel(asset.id, 1, labelOptions),
    onSuccess: (result) => {
      if (result.success) {
        onClose();
      }
    },
  });

  const handleDownload = () => {
    const params = new URLSearchParams();
    if (labelOptions.showAssignedTo !== undefined) params.set('showAssignedTo', String(labelOptions.showAssignedTo));
    if (labelOptions.showHostname !== undefined) params.set('showHostname', String(labelOptions.showHostname));
    if (labelOptions.showIpAddress !== undefined) params.set('showIpAddress', String(labelOptions.showIpAddress));
    const queryString = params.toString();
    window.open(`${api.downloadLabelUrl(asset.id)}${queryString ? '?' + queryString : ''}`, '_blank');
  };

  const toggleOption = (key: keyof LabelSettings) => {
    setLabelOptions(prev => ({ ...prev, [key]: !prev[key] }));
  };

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
          {/* Preview - Landscape layout matching actual print (v1.1.0) */}
          <div className="flex justify-center p-4 bg-gray-50 rounded-lg">
            <div
              className="bg-white border border-gray-400 rounded shadow-sm flex flex-col"
              style={{ width: '300px', minHeight: '130px' }}
            >
              {/* Assigned To - centered at top */}
              {labelOptions.showAssignedTo && asset.assignedTo && (
                <p className="text-sm font-bold text-center truncate px-2 pt-2">
                  {asset.assignedTo}
                </p>
              )}

              {/* Middle section: QR + text */}
              <div className="flex items-center gap-3 px-2 py-1 flex-1">
                <img
                  src={api.getLabelPreviewUrl(asset.id)}
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
                  {labelOptions.showIpAddress && asset.ipAddress && (
                    <p className="text-xs font-bold truncate">{asset.ipAddress}</p>
                  )}
                </div>
              </div>

              {/* Organization Name - centered at bottom */}
              <p className="text-sm font-bold text-gray-800 text-center truncate border-t border-gray-300 py-1 px-2">
                {orgData?.value || 'Organization Name'}
              </p>
            </div>
          </div>

          {/* Label Options Toggle */}
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <Settings className="w-4 h-4" />
            Label Options
            <span className="text-xs text-gray-400">{showOptions ? '▲' : '▼'}</span>
          </button>

          {showOptions && (
            <div className="p-3 bg-gray-50 rounded-lg space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={labelOptions.showAssignedTo ?? true}
                  onChange={() => toggleOption('showAssignedTo')}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Show Assigned To</span>
              </label>
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
            </div>
          )}

          {/* Error message */}
          {printMutation.isError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {printMutation.error instanceof Error ? printMutation.error.message : 'Print failed'}
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
          </div>
        </div>
      </div>
    </div>
  );
}
