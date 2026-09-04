import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { api } from '../../lib/api';
import { cn } from '../../lib/utils';

interface FilterState {
  year: string;
  status: string;
  categoryId: string;
  locationId: string;
  overdueMonths: string;
}

const REVIEW_STATUS_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  reviewed: {
    bg: 'bg-green-100',
    text: 'text-green-700',
    icon: <CheckCircle2 className="w-4 h-4" />
  },
  overdue: {
    bg: 'bg-red-100',
    text: 'text-red-700',
    icon: <AlertCircle className="w-4 h-4" />
  },
  never: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    icon: <Clock className="w-4 h-4" />
  }
};

export default function StocktakeReviewTab() {
  const [filters, setFilters] = useState<FilterState>({
    year: '',
    status: '',
    categoryId: '',
    locationId: '',
    overdueMonths: '12'
  });
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data: categoriesData } = useQuery({
    queryKey: ['lookups', 'categories'],
    queryFn: api.getCategories
  });

  const { data: locationsData } = useQuery({
    queryKey: ['lookups', 'locations'],
    queryFn: api.getLocations
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['reports', 'stocktakeReview', filters, page],
    queryFn: () =>
      api.getStocktakeReviewReport({
        year: filters.year,
        status: filters.status,
        category: filters.categoryId,
        location: filters.locationId,
        overdueMonths: filters.overdueMonths,
        skip: (page - 1) * pageSize,
        limit: pageSize
      })
  });

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const ReviewStatusBadge = ({ status }: { status: string }) => {
    const config = REVIEW_STATUS_COLORS[status] || REVIEW_STATUS_COLORS.reviewed;
    const label = status === 'overdue' ? 'Overdue' : status.charAt(0).toUpperCase() + status.slice(1);

    return (
      <div className={cn('inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium', config.bg, config.text)}>
        {config.icon}
        {label}
      </div>
    );
  };

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Failed to load stocktake review report</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="card p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="label">Overdue Threshold (Months)</label>
            <input
              type="number"
              value={filters.overdueMonths}
              onChange={(e) => handleFilterChange('overdueMonths', e.target.value)}
              className="input"
              min="0"
            />
          </div>
          <div>
            <label className="label">Review Year</label>
            <input
              type="number"
              value={filters.year}
              onChange={(e) => handleFilterChange('year', e.target.value)}
              className="input"
              placeholder="All years"
            />
          </div>
          <div>
            <label className="label">Review Status</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="input"
            >
              <option value="">All Statuses</option>
              <option value="reviewed">Reviewed</option>
              <option value="overdue">Overdue</option>
              <option value="never">Never Reviewed</option>
            </select>
          </div>
          <div>
            <label className="label">Category</label>
            <select
              value={filters.categoryId}
              onChange={(e) => handleFilterChange('categoryId', e.target.value)}
              className="input"
            >
              <option value="">All Categories</option>
              {categoriesData?.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Location</label>
            <select
              value={filters.locationId}
              onChange={(e) => handleFilterChange('locationId', e.target.value)}
              className="input"
            >
              <option value="">All Locations</option>
              {locationsData?.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-4">
              <p className="text-sm text-gray-600">Total Assets</p>
              <p className="text-2xl font-bold text-gray-900">{data.summary.totalAssets}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-600">Reviewed This Year</p>
              <p className="text-2xl font-bold text-green-600">{data.summary.reviewedThisYear}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-600">Overdue Count</p>
              <p className="text-2xl font-bold text-red-600">{data.summary.overdueCount}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-gray-600">Never Reviewed</p>
              <p className="text-2xl font-bold text-amber-600">{data.summary.neverReviewedCount}</p>
            </div>
          </div>

          {/* Chart - Reviews by Year */}
          {data.byYear.length > 0 && (
            <div className="card p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Reviews by Year</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data.byYear}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#2563eb" name="Review Count" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Assets Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Model
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Serial Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Location
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Review
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Days Since
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.assets.map((asset) => (
                    <tr key={asset.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-primary-600">
                        <a href={`/assets/${asset.id}`} className="hover:text-primary-700">
                          {asset.itemNumber}
                        </a>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{asset.model || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{asset.serialNumber || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {asset.category?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {asset.location?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {asset.lastReviewDate ? new Date(asset.lastReviewDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {asset.daysSinceReview !== null ? asset.daysSinceReview : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <ReviewStatusBadge status={asset.reviewStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
              <div className="text-sm text-gray-600">
                Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, data.pagination.total)} of{' '}
                {data.pagination.total}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="btn btn-secondary disabled:opacity-50"
                >
                  Previous
                </button>
                <div className="flex items-center gap-2">
                  {Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1)
                    .slice(Math.max(0, page - 3), Math.min(data.pagination.totalPages, page + 2))
                    .map((p) => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={cn(
                          'px-3 py-1 rounded text-sm',
                          page === p
                            ? 'bg-primary-600 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        {p}
                      </button>
                    ))}
                </div>
                <button
                  onClick={() => setPage(Math.min(data.pagination.totalPages, page + 1))}
                  disabled={page === data.pagination.totalPages}
                  className="btn btn-secondary disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
