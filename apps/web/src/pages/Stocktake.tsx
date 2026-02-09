import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  ClipboardCheck,
  Check,
  X,
  ChevronRight,
  ArrowLeft,
  Search,
  Scan,
  CheckCircle2,
  Circle,
  AlertCircle,
  Trash2
} from 'lucide-react';
import { api, Stocktake as StocktakeType } from '../lib/api';
import { cn, formatDate, CONDITION_LABELS } from '../lib/utils';

const STOCKTAKE_STATUS_COLORS: Record<string, string> = {
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-gray-100 text-gray-800'
};

const STOCKTAKE_STATUS_LABELS: Record<string, string> = {
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled'
};

export default function Stocktake() {
  const [selectedStocktake, setSelectedStocktake] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterVerified, setFilterVerified] = useState<'all' | 'verified' | 'unverified'>('all');

  const { data: stocktakes, isLoading } = useQuery({
    queryKey: ['stocktakes'],
    queryFn: api.getStocktakes
  });

  const { data: stocktakeDetail } = useQuery({
    queryKey: ['stocktake', selectedStocktake],
    queryFn: () => api.getStocktake(selectedStocktake!),
    enabled: !!selectedStocktake
  });

  if (selectedStocktake && stocktakeDetail) {
    return (
      <StocktakeDetail
        stocktake={stocktakeDetail}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        filterVerified={filterVerified}
        setFilterVerified={setFilterVerified}
        onBack={() => {
          setSelectedStocktake(null);
          setSearchQuery('');
          setFilterVerified('all');
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stocktake</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage asset verification and stocktakes
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Stocktake
        </button>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <CreateStocktakeForm onClose={() => setShowCreateForm(false)} />
      )}

      {/* Stocktakes List */}
      <div className="card">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : !stocktakes?.length ? (
          <div className="p-8 text-center text-gray-500">
            <ClipboardCheck className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>No stocktakes yet. Create your first stocktake to begin verifying assets.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {stocktakes.map((st) => (
              <StocktakeRow
                key={st.id}
                stocktake={st}
                onClick={() => setSelectedStocktake(st.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StocktakeRow({
  stocktake,
  onClick
}: {
  stocktake: StocktakeType;
  onClick: () => void;
}) {
  const progress = stocktake.totalCount
    ? Math.round((stocktake.verifiedCount || 0) / stocktake.totalCount * 100)
    : 0;

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-4 hover:bg-gray-50 cursor-pointer"
    >
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <h3 className="font-medium text-gray-900">{stocktake.name}</h3>
          <span className={cn(
            'px-2 py-0.5 text-xs font-medium rounded-full',
            STOCKTAKE_STATUS_COLORS[stocktake.status]
          )}>
            {STOCKTAKE_STATUS_LABELS[stocktake.status]}
          </span>
        </div>
        <div className="mt-1 text-sm text-gray-500">
          Started {formatDate(stocktake.startDate)}
          {stocktake.endDate && ` • Completed ${formatDate(stocktake.endDate)}`}
        </div>
        <div className="mt-2 flex items-center gap-4">
          <div className="flex-1 max-w-xs">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-600 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <span className="text-sm text-gray-600">
            {stocktake.verifiedCount || 0} / {stocktake.totalCount || 0} verified
          </span>
        </div>
      </div>
      <ChevronRight className="w-5 h-5 text-gray-400" />
    </div>
  );
}

function CreateStocktakeForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [locationId, setLocationId] = useState('');
  const queryClient = useQueryClient();

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories
  });

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: api.getLocations
  });

  const createMutation = useMutation({
    mutationFn: () => api.createStocktake({
      name,
      notes: notes || undefined,
      categoryId: categoryId || undefined,
      locationId: locationId || undefined
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocktakes'] });
      onClose();
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">New Stocktake</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="label">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Q1 2024 Stocktake"
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              className="input"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Filter by Category</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="input"
              >
                <option value="">All Categories</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Filter by Location</label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
                className="input"
              >
                <option value="">All Locations</option>
                {locations?.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          </div>
          {createMutation.error && (
            <p className="text-sm text-red-600">
              {(createMutation.error as Error).message}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="btn btn-primary"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Stocktake'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StocktakeDetail({
  stocktake,
  searchQuery,
  setSearchQuery,
  filterVerified,
  setFilterVerified,
  onBack
}: {
  stocktake: StocktakeType;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterVerified: 'all' | 'verified' | 'unverified';
  setFilterVerified: (f: 'all' | 'verified' | 'unverified') => void;
  onBack: () => void;
}) {
  const [quickVerifyInput, setQuickVerifyInput] = useState('');
  const [quickVerifyCondition, setQuickVerifyCondition] = useState('');
  const [quickVerifyStatus, setQuickVerifyStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const quickVerifyRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const verifiedCount = stocktake.records?.filter(r => r.verified).length || 0;
  const totalCount = stocktake.records?.length || 0;
  const progress = totalCount ? Math.round(verifiedCount / totalCount * 100) : 0;

  const verifyMutation = useMutation({
    mutationFn: ({ assetId, data }: { assetId: string; data?: any }) =>
      api.verifyAsset(stocktake.id, assetId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocktake', stocktake.id] });
      queryClient.invalidateQueries({ queryKey: ['stocktakes'] });
    }
  });

  const unverifyMutation = useMutation({
    mutationFn: (assetId: string) => api.unverifyAsset(stocktake.id, assetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocktake', stocktake.id] });
      queryClient.invalidateQueries({ queryKey: ['stocktakes'] });
    }
  });

  const quickVerifyMutation = useMutation({
    mutationFn: ({ itemNumber, condition }: { itemNumber: string; condition?: string }) =>
      api.quickVerify(stocktake.id, itemNumber, condition || undefined),
    onSuccess: (data) => {
      setQuickVerifyStatus({
        type: 'success',
        message: `Verified: ${data.asset?.itemNumber} - ${data.asset?.manufacturer?.name || ''} ${data.asset?.model || ''}`
      });
      setQuickVerifyInput('');
      queryClient.invalidateQueries({ queryKey: ['stocktake', stocktake.id] });
      queryClient.invalidateQueries({ queryKey: ['stocktakes'] });
      quickVerifyRef.current?.focus();
    },
    onError: (error: Error) => {
      setQuickVerifyStatus({ type: 'error', message: error.message });
      setQuickVerifyInput('');
      quickVerifyRef.current?.focus();
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: string) => api.updateStocktake(stocktake.id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocktake', stocktake.id] });
      queryClient.invalidateQueries({ queryKey: ['stocktakes'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.deleteStocktake(stocktake.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocktakes'] });
      onBack();
    }
  });

  const handleQuickVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickVerifyInput.trim()) return;
    setQuickVerifyStatus(null);
    quickVerifyMutation.mutate({
      itemNumber: quickVerifyInput.trim(),
      condition: quickVerifyCondition || undefined
    });
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this stocktake? This action cannot be undone.')) {
      deleteMutation.mutate();
    }
  };

  useEffect(() => {
    if (quickVerifyStatus) {
      const timer = setTimeout(() => setQuickVerifyStatus(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [quickVerifyStatus]);

  const filteredRecords = stocktake.records?.filter(record => {
    const matchesSearch = !searchQuery ||
      record.asset?.itemNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.asset?.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.asset?.model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.asset?.assignedTo?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter = filterVerified === 'all' ||
      (filterVerified === 'verified' && record.verified) ||
      (filterVerified === 'unverified' && !record.verified);

    return matchesSearch && matchesFilter;
  }) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <button onClick={onBack} className="p-2 rounded-md hover:bg-gray-100 mt-1">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{stocktake.name}</h1>
              <span className={cn(
                'px-2 py-0.5 text-xs font-medium rounded-full',
                STOCKTAKE_STATUS_COLORS[stocktake.status]
              )}>
                {STOCKTAKE_STATUS_LABELS[stocktake.status]}
              </span>
            </div>
            {stocktake.notes && (
              <p className="mt-1 text-sm text-gray-500">{stocktake.notes}</p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              Started {formatDate(stocktake.startDate)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {stocktake.status === 'IN_PROGRESS' && (
            <button
              onClick={() => updateStatusMutation.mutate('COMPLETED')}
              disabled={updateStatusMutation.isPending}
              className="btn btn-primary"
            >
              <Check className="w-4 h-4 mr-2" />
              Complete
            </button>
          )}
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

      {/* Progress */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">Progress</span>
          <span className="text-sm text-gray-600">{verifiedCount} / {totalCount} verified ({progress}%)</span>
        </div>
        <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-600 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Quick Verify */}
      {stocktake.status === 'IN_PROGRESS' && (
        <div className="card p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Scan className="w-4 h-4" />
            Quick Verify (Scan or Enter Item Number)
          </h3>
          <form onSubmit={handleQuickVerify} className="flex gap-2">
            <input
              ref={quickVerifyRef}
              type="text"
              value={quickVerifyInput}
              onChange={(e) => setQuickVerifyInput(e.target.value)}
              placeholder="Scan barcode or enter item number..."
              className="input flex-1"
              autoFocus
            />
            <select
              value={quickVerifyCondition}
              onChange={(e) => setQuickVerifyCondition(e.target.value)}
              className="input w-36"
            >
              <option value="">Same condition</option>
              {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary" disabled={quickVerifyMutation.isPending}>
              Verify
            </button>
          </form>
          {quickVerifyStatus && (
            <div className={cn(
              'mt-3 p-3 rounded-md flex items-center gap-2',
              quickVerifyStatus.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            )}>
              {quickVerifyStatus.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
              {quickVerifyStatus.message}
            </div>
          )}
        </div>
      )}

      {/* Search and Filter */}
      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pl-10"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setFilterVerified('all')}
              className={cn('btn', filterVerified === 'all' ? 'btn-primary' : 'btn-secondary')}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setFilterVerified('verified')}
              className={cn('btn', filterVerified === 'verified' ? 'btn-primary' : 'btn-secondary')}
            >
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Verified ({verifiedCount})
            </button>
            <button
              onClick={() => setFilterVerified('unverified')}
              className={cn('btn', filterVerified === 'unverified' ? 'btn-primary' : 'btn-secondary')}
            >
              <Circle className="w-4 h-4 mr-1" />
              Unverified ({totalCount - verifiedCount})
            </button>
          </div>
        </div>
      </div>

      {/* Records List */}
      <div className="card overflow-hidden">
        {filteredRecords.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No assets match your search.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Item #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Asset
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Condition
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Assigned To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Verified At
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRecords.map((record) => (
                  <tr key={record.id} className={cn(
                    'hover:bg-gray-50',
                    record.verified ? 'bg-green-50/30' : ''
                  )}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {record.verified ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-400" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {record.asset?.itemNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        {record.asset?.manufacturer?.name} {record.asset?.model}
                      </div>
                      <div className="text-xs text-gray-500">
                        {record.asset?.category?.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.asset?.condition ? CONDITION_LABELS[record.asset.condition] || record.asset.condition : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.asset?.location?.name || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.asset?.assignedTo || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {record.verifiedAt ? formatDate(record.verifiedAt) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      {stocktake.status === 'IN_PROGRESS' && (
                        record.verified ? (
                          <div className="flex items-center justify-end gap-2">
                            {record.newCondition && (
                              <span className="text-xs text-orange-600">
                                → {CONDITION_LABELS[record.newCondition]}
                              </span>
                            )}
                            <button
                              onClick={() => unverifyMutation.mutate(record.assetId)}
                              disabled={unverifyMutation.isPending}
                              className="btn btn-secondary btn-sm"
                            >
                              <X className="w-3 h-3 mr-1" />
                              Unverify
                            </button>
                          </div>
                        ) : (
                          <VerifyButton
                            assetId={record.assetId}
                            onVerify={(assetId: string, newCondition: string | null) => verifyMutation.mutate({
                              assetId,
                              data: {
                                locationMatch: true,
                                conditionMatch: !newCondition,
                                newCondition: newCondition || undefined
                              }
                            })}
                            disabled={verifyMutation.isPending}
                          />
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function VerifyButton({
  assetId,
  onVerify,
  disabled
}: {
  assetId: string;
  onVerify: (assetId: string, newCondition: string | null) => void;
  disabled: boolean;
}) {
  const [selectedCondition, setSelectedCondition] = useState('');

  return (
    <div className="flex items-center gap-1">
      <select
        value={selectedCondition}
        onChange={(e) => setSelectedCondition(e.target.value)}
        className="input input-sm text-xs py-1 px-2 w-24"
        onClick={(e) => e.stopPropagation()}
      >
        <option value="">Same</option>
        {Object.entries(CONDITION_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <button
        onClick={() => onVerify(assetId, selectedCondition || null)}
        disabled={disabled}
        className="btn btn-primary btn-sm"
      >
        <Check className="w-3 h-3" />
      </button>
    </div>
  );
}
