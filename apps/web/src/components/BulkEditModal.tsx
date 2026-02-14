import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { X, Edit2, Loader2 } from 'lucide-react';
import { api, Asset } from '../lib/api';
import { STATUS_LABELS, CONDITION_LABELS } from '../lib/utils';

interface BulkEditModalProps {
  assetIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkEditModal({ assetIds, onClose, onSuccess }: BulkEditModalProps) {
  const [status, setStatus] = useState('');
  const [condition, setCondition] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [decommissionDate, setDecommissionDate] = useState('');
  const [comments, setComments] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Load lookups
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories
  });

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: api.getLocations
  });

  // Auto-set decommission date when status changes to Decommissioned
  useEffect(() => {
    if (status && status.startsWith('Decommissioned')) {
      const today = new Date().toISOString().split('T')[0];
      setDecommissionDate(today);
    }
  }, [status]);

  const updateMutation = useMutation({
    mutationFn: (fields: Partial<Asset>) =>
      api.bulkUpdateAssets({ ids: assetIds, fields }),
    onSuccess: () => {
      // Auto-close after 1.5s on success
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    }
  });

  const handleSubmit = () => {
    setSubmitError('');

    // Check if at least one field is filled
    if (!status && !condition && !categoryId && !locationId && !decommissionDate && !comments.trim()) {
      setSubmitError('Please fill in at least one field');
      return;
    }

    // Build fields object with only filled values
    const fields: Partial<Asset> = {};
    if (status) fields.status = status as any;
    if (condition) fields.condition = condition as any;
    if (categoryId) fields.categoryId = categoryId;
    if (locationId) fields.locationId = locationId;
    if (decommissionDate) fields.decommissionDate = decommissionDate as any;
    if (comments.trim()) fields.comments = comments;

    updateMutation.mutate(fields);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Edit {assetIds.length} Assets</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <p className="text-sm text-gray-600">
            Only fields you fill in will be updated. Leave a field blank to keep existing values.
          </p>

          {/* Status */}
          <div>
            <label className="label">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="input"
            >
              <option value="">— no change —</option>
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Condition */}
          <div>
            <label className="label">Condition</label>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="input"
            >
              <option value="">— no change —</option>
              {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Category */}
          <div>
            <label className="label">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="input"
            >
              <option value="">— no change —</option>
              {categories?.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {/* Location */}
          <div>
            <label className="label">Location</label>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="input"
            >
              <option value="">— no change —</option>
              {locations?.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </div>

          {/* Decommission Date */}
          <div>
            <label className="label">Decommission Date</label>
            <input
              type="date"
              value={decommissionDate}
              onChange={(e) => setDecommissionDate(e.target.value)}
              className="input"
            />
          </div>

          {/* Comments */}
          <div>
            <label className="label">Comments</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              className="input"
              rows={3}
              placeholder="Add or update comments..."
            />
          </div>

          {/* Error message */}
          {submitError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {submitError}
            </div>
          )}

          {/* API error message */}
          {updateMutation.isError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {updateMutation.error instanceof Error ? updateMutation.error.message : 'Update failed'}
            </div>
          )}

          {/* Success message */}
          {updateMutation.isSuccess && (
            <div className="p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
              Updated {updateMutation.data.updated} asset{updateMutation.data.updated !== 1 ? 's' : ''}
              {updateMutation.data.failed > 0 && `, ${updateMutation.data.failed} failed`}
            </div>
          )}

          {/* Error list */}
          {updateMutation.isSuccess && updateMutation.data.errors.length > 0 && (
            <div className="text-sm">
              <p className="font-medium text-red-700 mb-2">Errors:</p>
              <ul className="text-red-600 space-y-1 max-h-32 overflow-y-auto">
                {updateMutation.data.errors.map((err, i) => (
                  <li key={i}>ID {err.id}: {err.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={updateMutation.isPending}
            className="btn btn-primary"
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <Edit2 className="w-4 h-4 mr-2" />
                Update {assetIds.length} Assets
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
