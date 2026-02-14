const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

export interface Asset {
  id: string;
  itemNumber: string;
  serialNumber: string | null;
  manufacturerId: string | null;
  manufacturer: { id: string; name: string } | null;
  model: string | null;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  description: string | null;
  status: string;
  condition: string;
  acquiredDate: string | null;
  purchasePrice: string | null;
  supplierId: string | null;
  supplier: { id: string; name: string } | null;
  orderNumber: string | null;
  hostname: string | null;
  deviceUsername: string | null;
  devicePassword: string | null;
  lanMacAddress: string | null;
  wlanMacAddress: string | null;
  ipAddress: string | null;
  assignedTo: string | null;
  locationId: string | null;
  location: { id: string; name: string } | null;
  warrantyExpiration: string | null;
  endOfLifeDate: string | null;
  lastReviewDate: string | null;
  decommissionDate: string | null;
  comments: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface Lookup {
  id: string;
  name: string;
  _count?: { assets: number };
}

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: 'ADMIN' | 'USER';
  isActive?: boolean;
  lastLogin?: string;
  createdAt?: string;
}

export interface AuthStatus {
  authenticated: boolean;
  user?: User;
}

export interface Stocktake {
  id: string;
  name: string;
  startDate: string;
  endDate: string | null;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  notes: string | null;
  verifiedCount?: number;
  totalCount?: number;
  records?: StocktakeRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface StocktakeRecord {
  id: string;
  stocktakeId: string;
  assetId: string;
  asset?: Asset;
  verified: boolean;
  verifiedAt: string | null;
  locationMatch: boolean | null;
  conditionMatch: boolean | null;
  newCondition: string | null;
  notes: string | null;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export interface BulkAddResult {
  created: number;
  failed: number;
  errors: { serialNumber: string; message: string }[];
}

export interface BulkUpdateResult {
  updated: number;
  failed: number;
  errors: { id: string; message: string }[];
}

export interface LabelSettings {
  printerName: string;
  showAssignedTo: boolean;
  showHostname: boolean;
  showIpAddress: boolean;
  // Note: Item Number, Model, and Serial Number are always shown
}

export interface PrintResult {
  success: boolean;
  message: string;
}

export interface BatchPrintResult {
  success: boolean;
  printed: number;
  failed: number;
  errors?: string[];
}

export const api = {
  // Auth
  getAuthStatus: () => fetchJson<AuthStatus>('/auth/status'),
  login: (username: string, password: string) =>
    fetchJson<{ success: boolean; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    }),
  logout: () => fetchJson<{ success: boolean }>('/auth/logout', { method: 'POST' }),
  changePassword: (currentPassword: string, newPassword: string) =>
    fetchJson<{ success: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword })
    }),
  verifyPassword: (password: string) =>
    fetchJson<{ valid: boolean }>('/auth/verify-password', {
      method: 'POST',
      body: JSON.stringify({ password })
    }),

  // Users (admin only)
  getUsers: () => fetchJson<User[]>('/auth/users'),
  createUser: (data: { username: string; password: string; fullName: string; role?: string }) =>
    fetchJson<User>('/auth/users', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateUser: (id: string, data: { fullName?: string; role?: string; isActive?: boolean }) =>
    fetchJson<User>(`/auth/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  resetUserPassword: (id: string, newPassword: string) =>
    fetchJson<{ success: boolean }>(`/auth/users/${id}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword })
    }),
  deleteUser: (id: string) =>
    fetchJson<{ success: boolean }>(`/auth/users/${id}`, {
      method: 'DELETE'
    }),

  // Assets
  getAssets: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    category?: string;
    manufacturer?: string;
    location?: string;
    sortBy?: string;
    sortOrder?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') {
          searchParams.set(key, String(value));
        }
      });
    }
    return fetchJson<PaginatedResponse<Asset>>(`/assets?${searchParams}`);
  },
  getAsset: (id: string) => fetchJson<Asset>(`/assets/${id}`),
  getNextItemNumber: () => fetchJson<{ nextItemNumber: string }>('/assets/next-item-number'),
  createAsset: (data: Partial<Asset>) => fetchJson<Asset>('/assets', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateAsset: (id: string, data: Partial<Asset>) => fetchJson<Asset>(`/assets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteAsset: (id: string) => fetchJson<{ success: boolean }>(`/assets/${id}`, {
    method: 'DELETE'
  }),
  bulkCreateAssets: (data: { sharedFields: Partial<Asset>; serialNumbers: string[]; assignedToList?: string[] }) =>
    fetchJson<BulkAddResult>('/assets/bulk', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  bulkUpdateAssets: (data: { ids: string[]; fields: Partial<Asset> }) =>
    fetchJson<BulkUpdateResult>('/assets/bulk-update', {
      method: 'PUT',
      body: JSON.stringify(data)
    }),

  // Lookups
  getCategories: () => fetchJson<Lookup[]>('/lookups/categories'),
  createCategory: (data: { name: string; description?: string }) =>
    fetchJson<Lookup>('/lookups/categories', { method: 'POST', body: JSON.stringify(data) }),
  deleteCategory: (id: string) =>
    fetchJson<{ success: boolean }>(`/lookups/categories/${id}`, { method: 'DELETE' }),

  getManufacturers: () => fetchJson<Lookup[]>('/lookups/manufacturers'),
  createManufacturer: (data: { name: string }) =>
    fetchJson<Lookup>('/lookups/manufacturers', { method: 'POST', body: JSON.stringify(data) }),
  deleteManufacturer: (id: string) =>
    fetchJson<{ success: boolean }>(`/lookups/manufacturers/${id}`, { method: 'DELETE' }),

  getSuppliers: () => fetchJson<Lookup[]>('/lookups/suppliers'),
  createSupplier: (data: { name: string }) =>
    fetchJson<Lookup>('/lookups/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  deleteSupplier: (id: string) =>
    fetchJson<{ success: boolean }>(`/lookups/suppliers/${id}`, { method: 'DELETE' }),

  getLocations: () => fetchJson<Lookup[]>('/lookups/locations'),
  createLocation: (data: { name: string }) =>
    fetchJson<Lookup>('/lookups/locations', { method: 'POST', body: JSON.stringify(data) }),
  deleteLocation: (id: string) =>
    fetchJson<{ success: boolean }>(`/lookups/locations/${id}`, { method: 'DELETE' }),

  getSavedFilters: () => fetchJson<any[]>('/lookups/filters'),

  // Settings
  getSetting: (key: string) => fetchJson<{ key: string; value: string }>(`/lookups/settings/${key}`),
  updateSetting: (key: string, value: string) =>
    fetchJson<{ key: string; value: string }>(`/lookups/settings/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value })
    }),

  // Stocktakes
  getStocktakes: () => fetchJson<Stocktake[]>('/stocktakes'),
  getStocktake: (id: string) => fetchJson<Stocktake>(`/stocktakes/${id}`),
  createStocktake: (data: { name: string; notes?: string; categoryId?: string; locationId?: string }) =>
    fetchJson<Stocktake>('/stocktakes', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateStocktake: (id: string, data: { name?: string; notes?: string; status?: string }) =>
    fetchJson<Stocktake>(`/stocktakes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteStocktake: (id: string) =>
    fetchJson<{ success: boolean }>(`/stocktakes/${id}`, { method: 'DELETE' }),
  verifyAsset: (stocktakeId: string, assetId: string, data?: {
    locationMatch?: boolean;
    conditionMatch?: boolean;
    newCondition?: string;
    notes?: string
  }) =>
    fetchJson<StocktakeRecord>(`/stocktakes/${stocktakeId}/verify/${assetId}`, {
      method: 'POST',
      body: JSON.stringify(data || {})
    }),
  unverifyAsset: (stocktakeId: string, assetId: string) =>
    fetchJson<StocktakeRecord>(`/stocktakes/${stocktakeId}/unverify/${assetId}`, {
      method: 'POST'
    }),
  quickVerify: (stocktakeId: string, itemNumber: string, newCondition?: string) =>
    fetchJson<StocktakeRecord>(`/stocktakes/${stocktakeId}/quick-verify`, {
      method: 'POST',
      body: JSON.stringify({ itemNumber, newCondition })
    }),

  // Import/Export
  downloadImportTemplate: () => {
    window.location.href = '/api/import/template';
  },

  exportAssets: () => {
    window.location.href = '/api/import/export';
  },

  importAssets: async (file: File, options?: { skipDuplicates?: boolean; updateExisting?: boolean }): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const params = new URLSearchParams();
    if (options?.skipDuplicates) params.set('skipDuplicates', 'true');
    if (options?.updateExisting) params.set('updateExisting', 'true');

    const response = await fetch(`/api/import/assets?${params}`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Import failed' }));
      throw new Error(error.error || 'Import failed');
    }
    return response.json();
  },

  // Labels
  getLabelPreviewUrl: (assetId: string) => `${API_BASE}/labels/preview/${assetId}`,
  downloadLabelUrl: (assetId: string) => `${API_BASE}/labels/download/${assetId}`,
  printLabel: (assetId: string, copies?: number, settings?: Partial<LabelSettings>) =>
    fetchJson<PrintResult>(`/labels/print/${assetId}`, {
      method: 'POST',
      body: JSON.stringify({ copies: copies || 1, ...settings })
    }),
  printLabelsBatch: (assetIds: string[], copies?: number, settings?: Partial<LabelSettings>) =>
    fetchJson<BatchPrintResult>('/labels/print-batch', {
      method: 'POST',
      body: JSON.stringify({ assetIds, copies: copies || 1, ...settings })
    }),
  getPrinters: () => fetchJson<string[]>('/labels/printers'),
  getLabelSettings: () => fetchJson<LabelSettings>('/labels/settings'),
  updateLabelSettings: (settings: Partial<LabelSettings>) =>
    fetchJson<LabelSettings>('/labels/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    }),

  // System
  triggerUpdate: () =>
    fetchJson<{ status: string }>('/system/update', { method: 'POST' }),
  getUpdateStatus: () =>
    fetchJson<{ updating: boolean }>('/system/update-status'),
};
