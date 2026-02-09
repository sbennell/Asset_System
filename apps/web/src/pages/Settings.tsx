import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Key, Building2, Users, Edit2, Shield, UserX, Upload, Download, CheckCircle2, AlertCircle, FileSpreadsheet, Printer } from 'lucide-react';
import { api, Lookup, User, ImportResult, LabelSettings as LabelSettingsType } from '../lib/api';
import { useAuth } from '../App';

export default function Settings() {
  const { isAdmin } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage organization, users, categories, manufacturers, suppliers, and locations
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OrganizationSetting />
        <LabelSettingsSection />
      </div>

      {isAdmin && <UserManagement />}

      {isAdmin && <DataImport />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LookupManager
          title="Categories"
          queryKey="categories"
          fetchFn={api.getCategories}
          createFn={api.createCategory}
          deleteFn={api.deleteCategory}
        />
        <LookupManager
          title="Manufacturers"
          queryKey="manufacturers"
          fetchFn={api.getManufacturers}
          createFn={api.createManufacturer}
          deleteFn={api.deleteManufacturer}
        />
        <LookupManager
          title="Suppliers"
          queryKey="suppliers"
          fetchFn={api.getSuppliers}
          createFn={api.createSupplier}
          deleteFn={api.deleteSupplier}
        />
        <LookupManager
          title="Locations"
          queryKey="locations"
          fetchFn={api.getLocations}
          createFn={api.createLocation}
          deleteFn={api.deleteLocation}
        />
      </div>

      <PasswordChange />
    </div>
  );
}

function LookupManager({
  title,
  queryKey,
  fetchFn,
  createFn,
  deleteFn
}: {
  title: string;
  queryKey: string;
  fetchFn: () => Promise<Lookup[]>;
  createFn: (data: { name: string }) => Promise<Lookup>;
  deleteFn: (id: string) => Promise<{ success: boolean }>;
}) {
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();

  const { data: items, isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: fetchFn
  });

  const createMutation = useMutation({
    mutationFn: createFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      setNewName('');
      setError('');
    },
    onError: (err: Error) => {
      setError(err.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (err: Error) => {
      setError(err.message);
    }
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newName.trim()) {
      createMutation.mutate({ name: newName.trim() });
    }
  };

  const handleDelete = (id: string, name: string, count?: number) => {
    if (count && count > 0) {
      setError(`Cannot delete "${name}" - it has ${count} asset${count !== 1 ? 's' : ''}`);
      return;
    }
    if (window.confirm(`Delete "${name}"?`)) {
      deleteMutation.mutate(id);
    }
  };

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Add form */}
      <form onSubmit={handleCreate} className="flex gap-2 mb-4">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={`New ${title.toLowerCase().slice(0, -1)}...`}
          className="input flex-1"
        />
        <button
          type="submit"
          disabled={!newName.trim() || createMutation.isPending}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : items?.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">No {title.toLowerCase()} yet</p>
      ) : (
        <ul className="divide-y divide-gray-200 max-h-64 overflow-y-auto">
          {items?.map((item) => (
            <li key={item.id} className="flex items-center justify-between py-2">
              <div>
                <span className="text-sm font-medium">{item.name}</span>
                {item._count?.assets !== undefined && (
                  <span className="ml-2 text-xs text-gray-500">
                    ({item._count.assets} asset{item._count.assets !== 1 ? 's' : ''})
                  </span>
                )}
              </div>
              <button
                onClick={() => handleDelete(item.id, item.name, item._count?.assets)}
                disabled={deleteMutation.isPending}
                className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OrganizationSetting() {
  const [organization, setOrganization] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['settings', 'organization'],
    queryFn: () => api.getSetting('organization')
  });

  useEffect(() => {
    if (data?.value) {
      setOrganization(data.value);
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: (value: string) => api.updateSetting('organization', value),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'organization'] });
      setSuccess('Organization saved successfully');
      setError('');
    },
    onError: (err: Error) => {
      setError(err.message);
      setSuccess('');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    mutation.mutate(organization);
  };

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Building2 className="w-5 h-5" />
        Organization
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-md">{success}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Organization Name</label>
          <input
            type="text"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder="Enter organization name..."
            className="input"
            disabled={isLoading}
          />
        </div>
        <button
          type="submit"
          disabled={mutation.isPending || isLoading}
          className="btn btn-primary"
        >
          {mutation.isPending ? 'Saving...' : 'Save'}
        </button>
      </form>
    </div>
  );
}

function LabelSettingsSection() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const queryClient = useQueryClient();

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['labelSettings'],
    queryFn: api.getLabelSettings
  });

  const { data: printers, isLoading: printersLoading } = useQuery({
    queryKey: ['printers'],
    queryFn: api.getPrinters
  });

  const mutation = useMutation({
    mutationFn: (updates: Partial<LabelSettingsType>) => api.updateLabelSettings(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labelSettings'] });
      setSuccess('Label settings saved');
      setError('');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: (err: Error) => {
      setError(err.message);
      setSuccess('');
    }
  });

  const handlePrinterChange = (printerName: string) => {
    mutation.mutate({ printerName });
  };

  const handleToggle = (field: keyof LabelSettingsType, value: boolean) => {
    mutation.mutate({ [field]: value });
  };

  const isLoading = settingsLoading || printersLoading;

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Printer className="w-5 h-5" />
        Label Printing
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-md">{success}</div>
      )}

      {isLoading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Printer Selection */}
          <div>
            <label className="label">Printer</label>
            <select
              value={settings?.printerName || ''}
              onChange={(e) => handlePrinterChange(e.target.value)}
              className="input"
              disabled={mutation.isPending}
            >
              <option value="">Select a printer...</option>
              {printers?.map((printer) => (
                <option key={printer} value={printer}>{printer}</option>
              ))}
              {settings?.printerName && !printers?.includes(settings.printerName) && (
                <option value={settings.printerName}>{settings.printerName} (not found)</option>
              )}
            </select>
            {printers?.length === 0 && (
              <p className="mt-1 text-xs text-gray-500">No printers detected</p>
            )}
          </div>

          {/* Label Content Options */}
          <div>
            <label className="label">Label Content</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings?.showModel ?? true}
                  onChange={(e) => handleToggle('showModel', e.target.checked)}
                  disabled={mutation.isPending}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Show Model</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings?.showHostname ?? true}
                  onChange={(e) => handleToggle('showHostname', e.target.checked)}
                  disabled={mutation.isPending}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Show Hostname</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={settings?.showSerialNumber ?? true}
                  onChange={(e) => handleToggle('showSerialNumber', e.target.checked)}
                  disabled={mutation.isPending}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Show Serial Number</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PasswordChange() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const mutation = useMutation({
    mutationFn: () => api.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setError('');
    },
    onError: (err: Error) => {
      setError(err.message);
      setSuccess('');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }

    mutation.mutate();
  };

  return (
    <div className="card p-6 max-w-md">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <Key className="w-5 h-5" />
        Change Password
      </h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md">{error}</div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-md">{success}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Current Password</label>
          <input
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="input"
            required
          />
        </div>
        <div>
          <label className="label">New Password</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="input"
            required
          />
        </div>
        <div>
          <label className="label">Confirm New Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input"
            required
          />
        </div>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="btn btn-primary"
        >
          {mutation.isPending ? 'Changing...' : 'Change Password'}
        </button>
      </form>
    </div>
  );
}

function UserManagement() {
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: api.getUsers
  });

  const createMutation = useMutation({
    mutationFn: api.createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowForm(false);
      setError('');
    },
    onError: (err: Error) => setError(err.message)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { fullName?: string; role?: string; isActive?: boolean } }) =>
      api.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditingUser(null);
      setError('');
    },
    onError: (err: Error) => setError(err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err: Error) => setError(err.message)
  });

  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      api.resetUserPassword(id, password),
    onSuccess: () => {
      setError('');
      alert('Password reset successfully');
    },
    onError: (err: Error) => setError(err.message)
  });

  const handleResetPassword = (user: User) => {
    const newPassword = prompt(`Enter new password for ${user.username}:`);
    if (newPassword && newPassword.length >= 4) {
      resetPasswordMutation.mutate({ id: user.id, password: newPassword });
    } else if (newPassword) {
      setError('Password must be at least 4 characters');
    }
  };

  const handleDelete = (user: User) => {
    if (user.id === currentUser?.id) {
      setError('Cannot delete your own account');
      return;
    }
    if (window.confirm(`Delete user "${user.username}"? This cannot be undone.`)) {
      deleteMutation.mutate(user.id);
    }
  };

  const handleToggleActive = (user: User) => {
    if (user.id === currentUser?.id) {
      setError('Cannot deactivate your own account');
      return;
    }
    updateMutation.mutate({
      id: user.id,
      data: { isActive: !user.isActive }
    });
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Users className="w-5 h-5" />
          User Management
        </h2>
        <button
          onClick={() => setShowForm(true)}
          className="btn btn-primary btn-sm"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add User
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">Dismiss</button>
        </div>
      )}

      {/* Create User Form Modal */}
      {showForm && (
        <UserForm
          onSubmit={(data) => createMutation.mutate(data)}
          onCancel={() => setShowForm(false)}
          isLoading={createMutation.isPending}
        />
      )}

      {/* Edit User Form Modal */}
      {editingUser && (
        <UserEditForm
          user={editingUser}
          onSubmit={(data) => updateMutation.mutate({ id: editingUser.id, data })}
          onCancel={() => setEditingUser(null)}
          isLoading={updateMutation.isPending}
        />
      )}

      {/* Users Table */}
      {isLoading ? (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Full Name</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Last Login</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users?.map((user) => (
                <tr key={user.id} className={!user.isActive ? 'bg-gray-50 opacity-60' : ''}>
                  <td className="px-4 py-3 text-sm font-medium">{user.username}</td>
                  <td className="px-4 py-3 text-sm">{user.fullName}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user.role === 'ADMIN' && <Shield className="w-3 h-3 mr-1" />}
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                      user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-sm text-right space-x-2">
                    <button
                      onClick={() => setEditingUser(user)}
                      className="p-1 text-gray-400 hover:text-blue-600"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleResetPassword(user)}
                      className="p-1 text-gray-400 hover:text-yellow-600"
                      title="Reset Password"
                    >
                      <Key className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(user)}
                      className="p-1 text-gray-400 hover:text-orange-600"
                      title={user.isActive ? 'Deactivate' : 'Activate'}
                      disabled={user.id === currentUser?.id}
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Delete"
                      disabled={user.id === currentUser?.id}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UserForm({ onSubmit, onCancel, isLoading }: {
  onSubmit: (data: { username: string; password: string; fullName: string; role: string }) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    fullName: '',
    role: 'USER'
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Create New User</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Full Name</label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="input"
              required
              minLength={4}
            />
          </div>
          <div>
            <label className="label">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="input"
            >
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="btn btn-primary">
              {isLoading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UserEditForm({ user, onSubmit, onCancel, isLoading }: {
  user: User;
  onSubmit: (data: { fullName: string; role: string }) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    fullName: user.fullName,
    role: user.role as string
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">Edit User: {user.username}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Full Name</label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              className="input"
            >
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <button type="button" onClick={onCancel} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isLoading} className="btn btn-primary">
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DataImport() {
  const [file, setFile] = useState<File | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(false);
  const [updateExisting, setUpdateExisting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const queryClient = useQueryClient();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv') && !selectedFile.name.endsWith('.xlsx')) {
        setError('Please select an Excel (.xlsx) or CSV file');
        return;
      }
      setFile(selectedFile);
      setResult(null);
      setError('');
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setIsImporting(true);
    setError('');
    setResult(null);

    try {
      const importResult = await api.importAssets(file, { skipDuplicates, updateExisting });
      setResult(importResult);
      setFile(null);
      // Reset file input
      const fileInput = document.getElementById('import-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      // Refresh asset list
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['manufacturers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['locations'] });
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="card p-6">
      <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
        <FileSpreadsheet className="w-5 h-5" />
        Data Import / Export
      </h2>

      <p className="text-sm text-gray-600 mb-4">
        Export all assets to Excel or import assets from an Excel/CSV file. The template includes dropdowns for easy data entry.
      </p>

      {/* Export / Download Template */}
      <div className="mb-6 flex flex-wrap gap-3">
        <button
          onClick={() => api.exportAssets()}
          className="btn btn-primary"
        >
          <Download className="w-4 h-4 mr-2" />
          Export All Assets
        </button>
        <button
          onClick={() => api.downloadImportTemplate()}
          className="btn btn-secondary"
        >
          <Download className="w-4 h-4 mr-2" />
          Download Import Template
        </button>
      </div>

      {/* File Upload */}
      <div className="mb-4">
        <label className="label">Select Excel or CSV File</label>
        <div className="flex items-center gap-4">
          <input
            id="import-file-input"
            type="file"
            accept=".xlsx,.csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-medium
              file:bg-primary-50 file:text-primary-700
              hover:file:bg-primary-100
              cursor-pointer"
          />
        </div>
        {file && (
          <p className="mt-2 text-sm text-gray-600">
            Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
          </p>
        )}
      </div>

      {/* Options */}
      <div className="mb-6 space-y-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={skipDuplicates}
            onChange={(e) => {
              setSkipDuplicates(e.target.checked);
              if (e.target.checked) setUpdateExisting(false);
            }}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-700">Skip duplicate item numbers</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={updateExisting}
            onChange={(e) => {
              setUpdateExisting(e.target.checked);
              if (e.target.checked) setSkipDuplicates(false);
            }}
            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-gray-700">Update existing assets (match by item number)</span>
        </label>
      </div>

      {/* Import Button */}
      <button
        onClick={handleImport}
        disabled={!file || isImporting}
        className="btn btn-primary"
      >
        {isImporting ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Importing...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            Import Assets
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-md flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="mt-4 p-4 bg-gray-50 rounded-md">
          <h3 className="font-medium text-gray-900 mb-3">Import Results</h3>
          <div className="space-y-2">
            {result.created > 0 && (
              <div className="flex items-center gap-2 text-green-700">
                <CheckCircle2 className="w-4 h-4" />
                <span>{result.created} asset{result.created !== 1 ? 's' : ''} created</span>
              </div>
            )}
            {result.updated > 0 && (
              <div className="flex items-center gap-2 text-blue-700">
                <CheckCircle2 className="w-4 h-4" />
                <span>{result.updated} asset{result.updated !== 1 ? 's' : ''} updated</span>
              </div>
            )}
            {result.skipped > 0 && (
              <div className="flex items-center gap-2 text-yellow-700">
                <AlertCircle className="w-4 h-4" />
                <span>{result.skipped} row{result.skipped !== 1 ? 's' : ''} skipped (duplicates)</span>
              </div>
            )}
            {result.errors.length > 0 && (
              <div className="mt-3">
                <p className="text-red-700 font-medium mb-2">
                  {result.errors.length} error{result.errors.length !== 1 ? 's' : ''}:
                </p>
                <ul className="text-sm text-red-600 space-y-1 max-h-32 overflow-y-auto">
                  {result.errors.map((err, i) => (
                    <li key={i}>Row {err.row}: {err.message}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
