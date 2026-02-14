import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Edit, Trash2, Printer, Eye, EyeOff } from 'lucide-react';
import { api } from '../lib/api';
import { formatDate, formatCurrency, STATUS_LABELS, STATUS_COLORS, CONDITION_LABELS, cn } from '../lib/utils';
import LabelPreviewModal from '../components/LabelPreviewModal';
import PasswordPromptModal from '../components/PasswordPromptModal';

export default function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showLabelModal, setShowLabelModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);

  const { data: asset, isLoading, error } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => api.getAsset(id!),
    enabled: !!id
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteAsset(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      navigate('/assets');
    }
  });

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this asset? This action cannot be undone.')) {
      deleteMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Asset not found or failed to load.</p>
        <Link to="/assets" className="btn btn-secondary mt-4">
          Back to Assets
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link to="/assets" className="p-2 rounded-md hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{asset.itemNumber}</h1>
            <p className="text-sm text-gray-500">
              {asset.manufacturer?.name} {asset.model}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowLabelModal(true)}
            className="btn btn-secondary"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Label
          </button>
          <Link to={`/assets/${id}/edit`} className="btn btn-secondary">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="btn btn-danger"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete
          </button>
        </div>
      </div>

      {/* Status badge */}
      <div>
        <span className={cn('px-3 py-1 text-sm font-medium rounded-full', STATUS_COLORS[asset.status])}>
          {STATUS_LABELS[asset.status] || asset.status}
        </span>
        <span className="ml-3 text-sm text-gray-500">
          Condition: {CONDITION_LABELS[asset.condition] || asset.condition}
        </span>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Basic Info */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
          <dl className="space-y-3">
            <DetailRow label="Item Number" value={asset.itemNumber} />
            <DetailRow label="Serial Number" value={asset.serialNumber} />
            <DetailRow label="Manufacturer" value={asset.manufacturer?.name} />
            <DetailRow label="Model" value={asset.model} />
            <DetailRow label="Category" value={asset.category?.name} />
            <DetailRow label="Description" value={asset.description} />
          </dl>
        </div>

        {/* Assignment & Location */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Assignment & Location</h2>
          <dl className="space-y-3">
            <DetailRow label="Assigned To" value={asset.assignedTo} />
            <DetailRow label="Location" value={asset.location?.name} />
          </dl>
        </div>

        {/* Device Details */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Device Details</h2>
          <dl className="space-y-3">
            <DetailRow label="Hostname" value={asset.hostname} />
            <DetailRow label="IP Address" value={asset.ipAddress} />
            <DetailRow label="LAN MAC Address" value={asset.lanMacAddress} />
            <DetailRow label="WLAN MAC Address" value={asset.wlanMacAddress} />
            <DetailRow label="Username" value={asset.deviceUsername} />
            <div className="flex justify-between">
              <dt className="text-sm font-medium text-gray-500">Password</dt>
              <dd className="text-sm text-gray-900 flex items-center gap-2">
                {asset.devicePassword ? (
                  <>
                    <span>{showPassword ? asset.devicePassword : '********'}</span>
                    <button
                      onClick={() => {
                        if (showPassword) {
                          setShowPassword(false);
                        } else {
                          setShowPasswordPrompt(true);
                        }
                      }}
                      className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </>
                ) : (
                  <span>-</span>
                )}
              </dd>
            </div>
          </dl>
        </div>

        {/* Purchase Info */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Purchase Information</h2>
          <dl className="space-y-3">
            <DetailRow label="Acquired Date" value={formatDate(asset.acquiredDate)} />
            <DetailRow label="Purchase Price" value={formatCurrency(asset.purchasePrice)} />
            <DetailRow label="Supplier" value={asset.supplier?.name} />
            <DetailRow label="Order Number" value={asset.orderNumber} />
          </dl>
        </div>

        {/* Lifecycle */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Lifecycle</h2>
          <dl className="space-y-3">
            <DetailRow label="Warranty Expiration" value={formatDate(asset.warrantyExpiration)} />
            <DetailRow label="End of Life Date" value={formatDate(asset.endOfLifeDate)} />
            <DetailRow label="Last Review Date" value={formatDate(asset.lastReviewDate)} />
            <DetailRow label="Decommission Date" value={formatDate(asset.decommissionDate)} />
          </dl>
        </div>

        {/* Comments */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Comments</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {asset.comments || 'No comments'}
          </p>
        </div>
      </div>

      {/* Metadata */}
      <div className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Record Information</h2>
        <dl className="flex flex-wrap gap-6">
          <DetailRow label="Created" value={formatDate(asset.createdAt)} inline />
          <DetailRow label="Last Updated" value={formatDate(asset.updatedAt)} inline />
          {(asset as any).auditLogs?.[0]?.user && (
            <DetailRow
              label="Last Edited By"
              value={(asset as any).auditLogs[0].user.fullName}
              inline
            />
          )}
        </dl>

        {/* Recent Edit History */}
        {(asset as any).auditLogs?.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Recent Changes</h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {(asset as any).auditLogs
                .filter((log: any) => log.action !== 'PRINT_LABEL')
                .slice(0, 10)
                .map((log: any) => {
                const changes = log.changes ? JSON.parse(log.changes) : null;
                const changedFields = changes?.before && changes?.after
                  ? Object.keys(changes.after).filter(key => {
                      const before = changes.before[key];
                      const after = changes.after[key];
                      return JSON.stringify(before) !== JSON.stringify(after) && after !== undefined;
                    })
                  : [];

                return (
                  <div
                    key={log.id}
                    className="text-sm py-2 border-b border-gray-100 last:border-0"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          log.action === 'CREATE' ? 'bg-green-100 text-green-800' :
                          log.action === 'UPDATE' || log.action === 'BULK_UPDATE' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {log.action}
                        </span>
                        <span className="text-gray-600">
                          {log.user?.fullName || 'Unknown'}
                        </span>
                      </div>
                      <span className="text-gray-500 text-xs">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                    {(log.action === 'UPDATE' || log.action === 'BULK_UPDATE') && changedFields.length > 0 && (
                      <div className="mt-2 pl-4 text-xs text-gray-600 space-y-1">
                        {changedFields.slice(0, 5).map(field => {
                          const before = changes.before[field];
                          const after = changes.after[field];
                          const fieldLabel = field.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                          return (
                            <div key={field} className="flex gap-1">
                              <span className="font-medium">{fieldLabel}:</span>
                              <span className="text-gray-400">{before || '(empty)'}</span>
                              <span className="text-gray-400">→</span>
                              <span className="text-gray-700">{after || '(empty)'}</span>
                            </div>
                          );
                        })}
                        {changedFields.length > 5 && (
                          <div className="text-gray-400">+{changedFields.length - 5} more fields</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Label Print Modal */}
      {showLabelModal && asset && (
        <LabelPreviewModal
          asset={asset}
          onClose={() => setShowLabelModal(false)}
        />
      )}

      {/* Password Prompt Modal */}
      {showPasswordPrompt && (
        <PasswordPromptModal
          onSuccess={() => {
            setShowPasswordPrompt(false);
            setShowPassword(true);
          }}
          onClose={() => setShowPasswordPrompt(false)}
        />
      )}
    </div>
  );
}

function DetailRow({
  label,
  value,
  inline = false
}: {
  label: string;
  value: string | null | undefined;
  inline?: boolean;
}) {
  if (inline) {
    return (
      <div>
        <dt className="text-xs font-medium text-gray-500">{label}</dt>
        <dd className="text-sm text-gray-900">{value || '-'}</dd>
      </div>
    );
  }

  return (
    <div className="flex justify-between">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{value || '-'}</dd>
    </div>
  );
}
