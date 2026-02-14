import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  createColumnHelper
} from '@tanstack/react-table';
import { Plus, Search, ChevronLeft, ChevronRight, Filter, X, ArrowUp, ArrowDown, Printer, Copy, Pencil } from 'lucide-react';
import { api, Asset } from '../lib/api';
import { cn, STATUS_LABELS, STATUS_COLORS } from '../lib/utils';
import BatchPrintModal from '../components/BatchPrintModal';
import BulkEditModal from '../components/BulkEditModal';

const columnHelper = createColumnHelper<Asset>();

const columns = [
  columnHelper.accessor('itemNumber', {
    header: 'Item #',
    cell: (info) => (
      <Link
        to={`/assets/${info.row.original.id}`}
        className="text-primary-600 hover:text-primary-800 font-medium"
      >
        {info.getValue()}
      </Link>
    )
  }),
  columnHelper.accessor('manufacturer', {
    header: 'Manufacturer',
    cell: (info) => info.getValue()?.name || '-'
  }),
  columnHelper.accessor('model', {
    header: 'Model',
    cell: (info) => info.getValue() || '-'
  }),
  columnHelper.accessor('category', {
    header: 'Category',
    cell: (info) => info.getValue()?.name || '-'
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => {
      const status = info.getValue();
      return (
        <span className={cn('px-2 py-1 text-xs font-medium rounded-full', STATUS_COLORS[status])}>
          {STATUS_LABELS[status] || status}
        </span>
      );
    }
  }),
  columnHelper.accessor('assignedTo', {
    header: 'Assigned To',
    cell: (info) => info.getValue() || '-'
  }),
  columnHelper.accessor('location', {
    header: 'Location',
    cell: (info) => info.getValue()?.name || '-'
  }),
  columnHelper.accessor('hostname', {
    header: 'Hostname',
    cell: (info) => info.getValue() || '-'
  })
];

export default function AssetList() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBatchPrintModal, setShowBatchPrintModal] = useState(false);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);

  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '50', 10);
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') ?? '_active';
  const category = searchParams.get('category') || '';
  const manufacturer = searchParams.get('manufacturer') || '';
  const location = searchParams.get('location') || '';
  const sortBy = searchParams.get('sortBy') || '';
  const sortOrder = searchParams.get('sortOrder') || '';

  const { data, isLoading, error } = useQuery({
    queryKey: ['assets', { page, limit, search, status, category, manufacturer, location, sortBy, sortOrder }],
    queryFn: () => api.getAssets({ page, limit, search, status, category, manufacturer, location, sortBy, sortOrder })
  });

  const handleSort = (column: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (sortBy === column) {
      // Toggle order or clear if already desc
      if (sortOrder === 'asc') {
        newParams.set('sortOrder', 'desc');
      } else {
        newParams.delete('sortBy');
        newParams.delete('sortOrder');
      }
    } else {
      newParams.set('sortBy', column);
      newParams.set('sortOrder', 'asc');
    }
    newParams.set('page', '1');
    setSearchParams(newParams);
  };

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories
  });

  const { data: manufacturers } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: api.getManufacturers
  });

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: api.getLocations
  });

  const table = useReactTable({
    data: data?.data || [],
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  const updateParams = (updates: Record<string, string | undefined>) => {
    const newParams = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
    });
    // Reset to page 1 when filters change
    if (!updates.page) {
      newParams.set('page', '1');
    }
    setSearchParams(newParams);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ search: searchInput || undefined });
  };

  const clearFilters = () => {
    setSearchInput('');
    setSearchParams({});
  };

  const hasFilters = search || (status && status !== '_active' && status !== '_all') || category || manufacturer || location;

  const toggleSelectAll = () => {
    if (!data?.data) return;
    const allIds = data.data.map(a => a.id);
    const allSelected = allIds.every(id => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBatchPrint = () => {
    if (selectedIds.size === 0) return;
    setShowBatchPrintModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assets</h1>
          <p className="mt-1 text-sm text-gray-500">
            {data?.pagination.total || 0} total assets
            {selectedIds.size > 0 && ` (${selectedIds.size} selected)`}
          </p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <>
              <button
                onClick={() => setShowBulkEditModal(true)}
                className="btn btn-secondary"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Edit Selected ({selectedIds.size})
              </button>
              <button
                onClick={handleBatchPrint}
                className="btn btn-secondary"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Labels ({selectedIds.size})
              </button>
            </>
          )}
          <Link to="/assets/bulk-add" className="btn btn-secondary">
            <Copy className="w-4 h-4 mr-2" />
            Bulk Add
          </Link>
          <Link to="/assets/new" className="btn btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Add Asset
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card p-4 space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search assets..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="input pl-10 pr-4"
              />
            </div>
          </form>

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn('btn', showFilters ? 'btn-primary' : 'btn-secondary')}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {hasFilters && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">
                Active
              </span>
            )}
          </button>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="flex flex-wrap gap-4 pt-4 border-t">
            <div className="w-48">
              <label className="label">Status</label>
              <select
                value={status}
                onChange={(e) => updateParams({ status: e.target.value })}
                className="input"
              >
                <option value="_active">Active</option>
                <option value="_all">All Statuses</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            <div className="w-48">
              <label className="label">Category</label>
              <select
                value={category}
                onChange={(e) => updateParams({ category: e.target.value || undefined })}
                className="input"
              >
                <option value="">All Categories</option>
                {categories?.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <div className="w-48">
              <label className="label">Manufacturer</label>
              <select
                value={manufacturer}
                onChange={(e) => updateParams({ manufacturer: e.target.value || undefined })}
                className="input"
              >
                <option value="">All Manufacturers</option>
                {manufacturers?.map((mfr) => (
                  <option key={mfr.id} value={mfr.id}>{mfr.name}</option>
                ))}
              </select>
            </div>

            <div className="w-48">
              <label className="label">Location</label>
              <select
                value={location}
                onChange={(e) => updateParams({ location: e.target.value || undefined })}
                className="input"
              >
                <option value="">All Locations</option>
                {locations?.map((loc) => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            {hasFilters && (
              <div className="flex items-end">
                <button onClick={clearFilters} className="btn btn-secondary">
                  <X className="w-4 h-4 mr-2" />
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">
            Error loading assets. Please try again.
          </div>
        ) : data?.data.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {hasFilters ? 'No assets match your filters.' : 'No assets yet. Add your first asset!'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={data?.data.length ? data.data.every(a => selectedIds.has(a.id)) : false}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </th>
                    {headerGroup.headers.map((header) => {
                      const columnId = header.column.id;
                      const isSortable = ['itemNumber', 'manufacturer', 'model', 'category', 'status', 'assignedTo', 'location', 'hostname'].includes(columnId);
                      const isSorted = sortBy === columnId;
                      return (
                        <th
                          key={header.id}
                          className={cn(
                            "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider",
                            isSortable && "cursor-pointer hover:bg-gray-100 select-none"
                          )}
                          onClick={() => isSortable && handleSort(columnId)}
                        >
                          <div className="flex items-center gap-1">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                            {isSortable && (
                              <span className="ml-1">
                                {isSorted ? (
                                  sortOrder === 'asc' ? (
                                    <ArrowUp className="w-3 h-3 text-primary-600" />
                                  ) : (
                                    <ArrowDown className="w-3 h-3 text-primary-600" />
                                  )
                                ) : (
                                  <ArrowUp className="w-3 h-3 text-gray-300" />
                                )}
                              </span>
                            )}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className={cn("hover:bg-gray-50", selectedIds.has(row.original.id) && "bg-primary-50")}>
                    <td className="px-4 py-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(row.original.id)}
                        onChange={() => toggleSelect(row.original.id)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                    </td>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-500">
                {data.pagination.totalPages > 1
                  ? `Page ${data.pagination.page} of ${data.pagination.totalPages}`
                  : `${data.pagination.total} assets`}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Show:</span>
                <select
                  value={limit}
                  onChange={(e) => updateParams({ limit: e.target.value, page: '1' })}
                  className="input py-1 px-2 text-sm w-20"
                >
                  <option value="50">50</option>
                  <option value="100">100</option>
                  <option value="200">200</option>
                  <option value="500">500</option>
                  <option value="1000">1000</option>
                  <option value="10000">All</option>
                </select>
              </div>
            </div>
            {data.pagination.totalPages > 1 && (
              <div className="flex gap-2">
                <button
                  onClick={() => updateParams({ page: String(page - 1) })}
                  disabled={page <= 1}
                  className="btn btn-secondary"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => updateParams({ page: String(page + 1) })}
                  disabled={page >= data.pagination.totalPages}
                  className="btn btn-secondary"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Batch Print Modal */}
      {showBatchPrintModal && (
        <BatchPrintModal
          assetIds={Array.from(selectedIds)}
          onClose={() => setShowBatchPrintModal(false)}
          onSuccess={() => setSelectedIds(new Set())}
        />
      )}

      {/* Bulk Edit Modal */}
      {showBulkEditModal && (
        <BulkEditModal
          assetIds={Array.from(selectedIds)}
          onClose={() => setShowBulkEditModal(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            setSelectedIds(new Set());
          }}
        />
      )}
    </div>
  );
}
