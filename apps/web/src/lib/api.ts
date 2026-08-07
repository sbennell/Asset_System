const API_BASE = '/api';

// ============ IP Address Types ============

export interface AssetIPEntry {
  id: string;
  ip: string;
  label: string | null;
}

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

export interface Student {
  id: string;
  firstName: string;
  surname: string;
  homeGroup: string | null;
  schoolYear: string | null;
  status: string;
  birthdate: string | null;
  username: string | null;
  edupassUsername: string | null;
  email: string | null;
  password: string | null;
  assets?: Array<{
    id: string;
    itemNumber: string;
    model: string | null;
    categoryId: string | null;
    status: string;
    createdAt: string;
    category?: { id: string; name: string } | null;
  }>;
}

export interface StudentSummary {
  id: string;
  firstName: string;
  surname: string;
  schoolYear: string | null;
  homeGroup: string | null;
}

export interface StudentImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
}

export interface ReconcileResult {
  linked: number;
  skipped: number;
  unmatched: string[];
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
  ipAddresses: AssetIPEntry[];
  assignedTo: string | null;
  studentId: string | null;
  student: { id: string; firstName: string; surname: string; prefName: string | null } | null;
  locationId: string | null;
  location: { id: string; name: string } | null;
  warrantyExpiration: string | null;
  endOfLifeDate: string | null;
  lastReviewDate: string | null;
  decommissionDate: string | null;
  comments: string | null;
  businessPurpose: string | null;
  businessOwner: string | null;
  technicalOwner: string | null;
  version: string | null;
  criticalityTier: string | null;
  dataClassification: string | null;
  hostingType: string | null;
  supportType: string | null;
  internetFacing: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface SoftwareAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface Software {
  id: string;
  itemNumber: string;
  name: string;
  publisherId: string | null;
  publisher: { id: string; name: string } | null;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  description: string | null;
  version: string | null;
  url: string | null;
  appStore: string | null;
  deploymentMechanism: string | null;
  status: string;
  businessPurpose: string | null;
  businessOwner: string | null;
  technicalOwner: string | null;
  initialInstallDate: string | null;
  licenseExpiration: string | null;
  licenseCount: number | null;
  supplierId: string | null;
  supplier: { id: string; name: string } | null;
  lastReviewDate: string | null;
  decommissionDate: string | null;
  comments: string | null;
  criticalityTier: string | null;
  dataClassification: string | null;
  hostingType: string | null;
  supportType: string | null;
  internetFacing: boolean | null;
  attachments?: SoftwareAttachment[];
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
  _count?: { assets?: number; software?: number };
}

export type PermissionFlag =
  | 'canAccessAssets'
  | 'canAccessStudents'
  | 'canAccessStocktake'
  | 'canAccessReports'
  | 'canAccessSoftware'
  | 'canViewDevicePasswords'
  | 'canViewStudentPasswords';

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: 'ADMIN' | 'USER';
  canAccessAssets: boolean;
  canAccessStudents: boolean;
  canAccessStocktake: boolean;
  canAccessReports: boolean;
  canAccessSoftware: boolean;
  canViewDevicePasswords: boolean;
  canViewStudentPasswords: boolean;
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
  labelType: 'brother-dk22211' | 'dymo-1933081';
  showAssignedTo: boolean;
  showHostname: boolean;
  showIpAddress: boolean;
  qrCodeContent: 'full' | 'itemNumber';
  // Note: Item Number, Model, and Serial Number are always shown
}

export interface Subnet {
  id: string;
  name: string;
  cidr: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubnetIPAsset {
  id: string;
  itemNumber: string;
  model: string | null;
  hostname: string | null;
  assignedTo: string | null;
  status: string;
  ipAddress: string | null;
}

export interface SubnetIP {
  ip: string;
  asset: SubnetIPAsset | null;
  label: string | null;
}

export interface SubnetIPResponse {
  subnet: Subnet;
  ips: SubnetIP[];
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

export interface ReviewReportSummary {
  totalAssets: number;
  reviewedThisYear: number;
  overdueCount: number;
  neverReviewedCount: number;
}

export interface ReviewByYear {
  year: number;
  count: number;
}

export interface ReviewAssetRow {
  id: string;
  itemNumber: string;
  model: string | null;
  serialNumber: string | null;
  category: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  manufacturer: { id: string; name: string } | null;
  status: string;
  lastReviewDate: string | null;
  reviewYear: number | null;
  reviewStatus: 'reviewed' | 'overdue' | 'never';
  daysSinceReview: number | null;
}

export interface StocktakeReviewReport {
  summary: ReviewReportSummary;
  byYear: ReviewByYear[];
  assets: ReviewAssetRow[];
  pagination: { skip: number; limit: number; total: number; totalPages: number };
  meta: { overdueThresholdMonths: number; generatedAt: string };
}

export interface WarrantyReportSummary {
  noWarranty: number;
  expired: number;
  expiringSoon: number;
  ok: number;
}

export interface WarrantyAssetRow {
  id: string;
  itemNumber: string;
  model: string | null;
  serialNumber: string | null;
  status: string;
  manufacturer: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  warrantyExpiration: string | null;
  daysUntilExpiry: number | null;
  warrantyStatus: 'no_warranty' | 'expired' | 'expiring_soon' | 'ok';
}

export interface WarrantyReport {
  summary: WarrantyReportSummary;
  byMonth: Array<{ month: string; count: number }>;
  assets: WarrantyAssetRow[];
  pagination: { skip: number; limit: number; total: number; totalPages: number };
  meta: { thresholdDays: number; generatedAt: string };
}

export interface ConditionReportSummary {
  NEW: number;
  EXCELLENT: number;
  GOOD: number;
  FAIR: number;
  POOR: number;
  NON_FUNCTIONAL: number;
}

export interface ConditionAssetRow {
  id: string;
  itemNumber: string;
  model: string | null;
  status: string;
  condition: string;
  category: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
}

export interface ConditionReport {
  summary: ConditionReportSummary;
  byCondition: Array<{ condition: string; count: number }>;
  byCategory: Array<{
    category: string;
    NEW: number;
    EXCELLENT: number;
    GOOD: number;
    FAIR: number;
    POOR: number;
    NON_FUNCTIONAL: number;
    total: number;
  }>;
  assets: ConditionAssetRow[];
  pagination: { skip: number; limit: number; total: number; totalPages: number };
  meta: { generatedAt: string };
}

export interface ValueReportSummary {
  totalValue: number;
  avgValue: number;
  assetCount: number;
  assetsWithPrice: number;
  assetsWithoutPrice: number;
  maxValue: number;
  minValue: number;
}

export interface ValueAssetRow {
  id: string;
  itemNumber: string;
  model: string | null;
  status: string;
  purchasePrice: number | null;
  acquiredDate: string | null;
  category: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  manufacturer: { id: string; name: string } | null;
}

export interface ValueReport {
  summary: ValueReportSummary;
  byCategory: Array<{ category: string; count: number; totalValue: number; avgValue: number }>;
  byLocation: Array<{ location: string; count: number; totalValue: number }>;
  byManufacturer: Array<{ manufacturer: string; count: number; totalValue: number; avgValue: number }>;
  assets: ValueAssetRow[];
  pagination: { skip: number; limit: number; total: number; totalPages: number };
  meta: { generatedAt: string };
}

export interface LifecycleReportSummary {
  total: number;
  avgAgeYears: number;
  noAcquiredDate: number;
  eolPassed: number;
  eolUpcoming: number;
}

export interface LifecycleAssetRow {
  id: string;
  itemNumber: string;
  model: string | null;
  status: string;
  category: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  acquiredDate: string | null;
  endOfLifeDate: string | null;
  ageYears: number | null;
  ageGroup: string;
  daysUntilEol: number | null;
  eolStatus: 'no_eol_date' | 'passed' | 'upcoming' | 'ok';
}

export interface LifecycleReport {
  summary: LifecycleReportSummary;
  byAgeGroup: Array<{ ageGroup: string; count: number }>;
  assets: LifecycleAssetRow[];
  pagination: { skip: number; limit: number; total: number; totalPages: number };
  meta: { eolThresholdDays: number; generatedAt: string };
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
  createUser: (data: {
    username: string;
    password: string;
    fullName: string;
    role?: string;
  } & Partial<Record<PermissionFlag, boolean>>) =>
    fetchJson<User>('/auth/users', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateUser: (id: string, data: {
    fullName?: string;
    role?: string;
    isActive?: boolean;
  } & Partial<Record<PermissionFlag, boolean>>) =>
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
    stocktakeStatus?: string;
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

  // Software
  getSoftwareList: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    category?: string;
    publisher?: string;
    supplier?: string;
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
    return fetchJson<PaginatedResponse<Software>>(`/software?${searchParams}`);
  },
  getSoftware: (id: string) => fetchJson<Software>(`/software/${id}`),
  getNextSoftwareItemNumber: () => fetchJson<{ nextItemNumber: string }>('/software/next-item-number'),
  createSoftware: (data: Partial<Software>) => fetchJson<Software>('/software', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateSoftware: (id: string, data: Partial<Software>) => fetchJson<Software>(`/software/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteSoftware: (id: string) => fetchJson<{ success: boolean }>(`/software/${id}`, {
    method: 'DELETE'
  }),
  getSoftwareHistory: (id: string) => fetchJson<any[]>(`/software/${id}/history`),
  exportSoftware: () => {
    window.location.href = '/api/software/export';
  },
  importSoftware: async (file: File, options?: { skipDuplicates?: boolean; updateExisting?: boolean }): Promise<ImportResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const params = new URLSearchParams();
    if (options?.skipDuplicates) params.set('skipDuplicates', 'true');
    if (options?.updateExisting) params.set('updateExisting', 'true');

    const response = await fetch(`/api/software/import?${params}`, {
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

  getSoftwareAttachments: (softwareId: string) =>
    fetchJson<SoftwareAttachment[]>(`/software/${softwareId}/attachments`),
  uploadSoftwareAttachment: async (softwareId: string, file: File): Promise<SoftwareAttachment> => {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/software/${softwareId}/attachments`, {
      method: 'POST',
      credentials: 'include',
      body: formData
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(error.error || 'Upload failed');
    }
    return response.json();
  },
  getSoftwareAttachmentDownloadUrl: (softwareId: string, attachmentId: string) =>
    `${API_BASE}/software/${softwareId}/attachments/${attachmentId}`,
  deleteSoftwareAttachment: (softwareId: string, attachmentId: string) =>
    fetchJson<{ success: boolean }>(`/software/${softwareId}/attachments/${attachmentId}`, {
      method: 'DELETE'
    }),

  // Students
  getStudents: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    schoolYear?: string;
    homeGroup?: string;
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
    return fetchJson<PaginatedResponse<Student>>(`/students?${searchParams}`);
  },
  getStudent: (id: string) => fetchJson<Student>(`/students/${id}`),
  searchStudents: (q: string) => fetchJson<StudentSummary[]>(`/students/search?q=${encodeURIComponent(q)}`),
  createStudent: (data: Partial<Student>) => fetchJson<Student>('/students', {
    method: 'POST',
    body: JSON.stringify(data)
  }),
  updateStudent: (id: string, data: Partial<Student>) => fetchJson<Student>(`/students/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  deleteStudent: (id: string) => fetchJson<{ success: boolean }>(`/students/${id}`, {
    method: 'DELETE'
  }),
  runStudentImport: () => fetchJson<StudentImportResult>('/students/import/run', { method: 'POST' }),
  reconcileStudentAssets: () => fetchJson<ReconcileResult>('/students/reconcile-assets', { method: 'POST' }),
  getStudentStatuses: () => fetchJson<string[]>('/students/statuses'),
  getStudentYearLevels: () => fetchJson<string[]>('/students/year-levels'),
  getStudentHomeGroups: () => fetchJson<string[]>('/students/home-groups'),
  getStudentImportHeaders: () => fetchJson<string[]>('/students/import/headers'),
  getStudentLoginCardsUrl: (params: { homeGroup?: string; schoolYear?: string; studentId?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.studentId) qs.set('studentId', params.studentId);
    else if (params.homeGroup) qs.set('homeGroup', params.homeGroup);
    else if (params.schoolYear) qs.set('schoolYear', params.schoolYear);
    return `${API_BASE}/students/login-cards${qs.toString() ? `?${qs}` : ''}`;
  },
  getStudentsExportUrl: (params: { search?: string; status?: string; schoolYear?: string; homeGroup?: string; fields?: string[] } = {}) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.status) qs.set('status', params.status);
    if (params.schoolYear) qs.set('schoolYear', params.schoolYear);
    if (params.homeGroup) qs.set('homeGroup', params.homeGroup);
    if (params.fields && params.fields.length > 0) qs.set('fields', params.fields.join(','));
    return `${API_BASE}/students/export${qs.toString() ? `?${qs}` : ''}`;
  },

  // Lookups
  getCategories: () => fetchJson<Lookup[]>('/lookups/categories'),
  createCategory: (data: { name: string; description?: string }) =>
    fetchJson<Lookup>('/lookups/categories', { method: 'POST', body: JSON.stringify(data) }),
  updateCategory: (id: string, data: { name: string; description?: string }) =>
    fetchJson<Lookup>(`/lookups/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCategory: (id: string) =>
    fetchJson<{ success: boolean }>(`/lookups/categories/${id}`, { method: 'DELETE' }),

  getManufacturers: () => fetchJson<Lookup[]>('/lookups/manufacturers'),
  createManufacturer: (data: { name: string }) =>
    fetchJson<Lookup>('/lookups/manufacturers', { method: 'POST', body: JSON.stringify(data) }),
  updateManufacturer: (id: string, data: { name: string }) =>
    fetchJson<Lookup>(`/lookups/manufacturers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteManufacturer: (id: string) =>
    fetchJson<{ success: boolean }>(`/lookups/manufacturers/${id}`, { method: 'DELETE' }),

  getSuppliers: () => fetchJson<Lookup[]>('/lookups/suppliers'),
  createSupplier: (data: { name: string }) =>
    fetchJson<Lookup>('/lookups/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: string, data: { name: string }) =>
    fetchJson<Lookup>(`/lookups/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplier: (id: string) =>
    fetchJson<{ success: boolean }>(`/lookups/suppliers/${id}`, { method: 'DELETE' }),

  getLocations: () => fetchJson<Lookup[]>('/lookups/locations'),
  createLocation: (data: { name: string }) =>
    fetchJson<Lookup>('/lookups/locations', { method: 'POST', body: JSON.stringify(data) }),
  updateLocation: (id: string, data: { name: string }) =>
    fetchJson<Lookup>(`/lookups/locations/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLocation: (id: string) =>
    fetchJson<{ success: boolean }>(`/lookups/locations/${id}`, { method: 'DELETE' }),

  getSoftwarePublishers: () => fetchJson<Lookup[]>('/lookups/software-publishers'),
  createSoftwarePublisher: (data: { name: string; website?: string; supportUrl?: string; contactInfo?: string }) =>
    fetchJson<Lookup>('/lookups/software-publishers', { method: 'POST', body: JSON.stringify(data) }),
  updateSoftwarePublisher: (id: string, data: { name: string; website?: string; supportUrl?: string; contactInfo?: string }) =>
    fetchJson<Lookup>(`/lookups/software-publishers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSoftwarePublisher: (id: string) =>
    fetchJson<{ success: boolean }>(`/lookups/software-publishers/${id}`, { method: 'DELETE' }),

  getSoftwareCategories: () => fetchJson<Lookup[]>('/lookups/software-categories'),
  createSoftwareCategory: (data: { name: string; description?: string }) =>
    fetchJson<Lookup>('/lookups/software-categories', { method: 'POST', body: JSON.stringify(data) }),
  updateSoftwareCategory: (id: string, data: { name: string; description?: string }) =>
    fetchJson<Lookup>(`/lookups/software-categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSoftwareCategory: (id: string) =>
    fetchJson<{ success: boolean }>(`/lookups/software-categories/${id}`, { method: 'DELETE' }),

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

  exportAssetsMacs: () => {
    window.location.href = '/api/import/export-macs';
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
  getDymoLabelXml: (assetId: string, settings?: Partial<LabelSettings>) => {
    const params = new URLSearchParams();
    if (settings?.showAssignedTo !== undefined) params.set('showAssignedTo', String(settings.showAssignedTo));
    if (settings?.showHostname !== undefined) params.set('showHostname', String(settings.showHostname));
    if (settings?.showIpAddress !== undefined) params.set('showIpAddress', String(settings.showIpAddress));
    if (settings?.qrCodeContent !== undefined) params.set('qrCodeContent', settings.qrCodeContent);
    const queryString = params.toString();
    return fetchJson<{ itemNumber: string; xml: string }>(`/labels/dymo-xml/${assetId}${queryString ? '?' + queryString : ''}`);
  },
  getDymoLabelXmlBatch: (assetIds: string[], settings?: Partial<LabelSettings>) => {
    const params = new URLSearchParams();
    params.set('assetIds', assetIds.join(','));
    if (settings?.showAssignedTo !== undefined) params.set('showAssignedTo', String(settings.showAssignedTo));
    if (settings?.showHostname !== undefined) params.set('showHostname', String(settings.showHostname));
    if (settings?.showIpAddress !== undefined) params.set('showIpAddress', String(settings.showIpAddress));
    if (settings?.qrCodeContent !== undefined) params.set('qrCodeContent', settings.qrCodeContent);
    return fetchJson<{ labels: { assetId: string; itemNumber: string; xml: string }[]; notFound: string[] }>(`/labels/dymo-xml-batch?${params.toString()}`);
  },
  getLabelSettings: () => fetchJson<LabelSettings>('/labels/settings'),
  updateLabelSettings: (settings: Partial<LabelSettings>) =>
    fetchJson<LabelSettings>('/labels/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    }),

  // Reports
  getStocktakeReviewReport: (params?: {
    year?: string;
    status?: string;
    category?: string;
    location?: string;
    overdueMonths?: string;
    skip?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') searchParams.set(key, String(value));
      });
    }
    return fetchJson<StocktakeReviewReport>(`/reports/stocktake-review?${searchParams}`);
  },

  getWarrantyReport: (params?: {
    days?: string;
    category?: string;
    location?: string;
    skip?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') searchParams.set(key, String(value));
      });
    }
    return fetchJson<WarrantyReport>(`/reports/warranty?${searchParams}`);
  },

  getConditionReport: (params?: {
    category?: string;
    location?: string;
    skip?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') searchParams.set(key, String(value));
      });
    }
    return fetchJson<ConditionReport>(`/reports/condition?${searchParams}`);
  },

  getValueReport: (params?: {
    category?: string;
    location?: string;
    manufacturer?: string;
    skip?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') searchParams.set(key, String(value));
      });
    }
    return fetchJson<ValueReport>(`/reports/value?${searchParams}`);
  },

  getLifecycleReport: (params?: {
    category?: string;
    location?: string;
    eolDays?: string;
    skip?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== '') searchParams.set(key, String(value));
      });
    }
    return fetchJson<LifecycleReport>(`/reports/lifecycle?${searchParams}`);
  },

  // Asset IP Management
  addAssetIP: (assetId: string, data: { ip: string; label?: string }) =>
    fetchJson<AssetIPEntry>(`/assets/${assetId}/ips`, {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateAssetIP: (assetId: string, ipId: string, data: Partial<{ ip: string; label: string }>) =>
    fetchJson<AssetIPEntry>(`/assets/${assetId}/ips/${ipId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteAssetIP: (assetId: string, ipId: string) =>
    fetchJson<{ success: boolean }>(`/assets/${assetId}/ips/${ipId}`, {
      method: 'DELETE'
    }),

  // System
  triggerUpdate: () =>
    fetchJson<{ status: string }>('/system/update', { method: 'POST' }),
  getUpdateStatus: () =>
    fetchJson<{ updating: boolean }>('/system/update-status'),

  // Network / Subnets
  getSubnets: () => fetchJson<Subnet[]>('/network/subnets'),
  createSubnet: (data: { name: string; cidr: string }) =>
    fetchJson<Subnet>('/network/subnets', {
      method: 'POST',
      body: JSON.stringify(data)
    }),
  updateSubnet: (id: string, data: Partial<{ name: string; cidr: string }>) =>
    fetchJson<Subnet>(`/network/subnets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    }),
  deleteSubnet: (id: string) =>
    fetchJson<{ success: boolean }>(`/network/subnets/${id}`, {
      method: 'DELETE'
    }),
  getSubnetIPs: (id: string) =>
    fetchJson<SubnetIPResponse>(`/network/subnets/${id}/ips`),
};
