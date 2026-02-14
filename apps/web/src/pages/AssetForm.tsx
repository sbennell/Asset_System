import { useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Save } from 'lucide-react';
import { api, Asset } from '../lib/api';
import { STATUS_LABELS, CONDITION_LABELS } from '../lib/utils';

type AssetFormData = {
  itemNumber: string;
  serialNumber: string;
  manufacturerId: string;
  model: string;
  categoryId: string;
  description: string;
  status: string;
  condition: string;
  acquiredDate: string;
  purchasePrice: string;
  supplierId: string;
  orderNumber: string;
  hostname: string;
  deviceUsername: string;
  devicePassword: string;
  lanMacAddress: string;
  wlanMacAddress: string;
  ipAddress: string;
  assignedTo: string;
  locationId: string;
  warrantyExpiration: string;
  endOfLifeDate: string;
  lastReviewDate: string;
  decommissionDate: string;
  comments: string;
};

export default function AssetForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<AssetFormData>({
    defaultValues: {
      status: 'In Use',
      condition: 'GOOD'
    }
  });

  const status = watch('status');

  // Fetch asset if editing
  const { data: asset } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => api.getAsset(id!),
    enabled: isEditing
  });

  // Fetch next item number for new assets
  const { data: nextItemData } = useQuery({
    queryKey: ['next-item-number'],
    queryFn: api.getNextItemNumber,
    enabled: !isEditing
  });

  // Fetch lookups
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: api.getCategories
  });
  const { data: manufacturers } = useQuery({
    queryKey: ['manufacturers'],
    queryFn: api.getManufacturers
  });
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: api.getSuppliers
  });
  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: api.getLocations
  });

  // Prefill next item number for new assets
  useEffect(() => {
    if (!isEditing && nextItemData?.nextItemNumber) {
      setValue('itemNumber', nextItemData.nextItemNumber);
    }
  }, [isEditing, nextItemData, setValue]);

  // Populate form when asset loads
  useEffect(() => {
    if (asset) {
      reset({
        itemNumber: asset.itemNumber || '',
        serialNumber: asset.serialNumber || '',
        manufacturerId: asset.manufacturerId || '',
        model: asset.model || '',
        categoryId: asset.categoryId || '',
        description: asset.description || '',
        status: asset.status || 'In Use',
        condition: asset.condition || 'GOOD',
        acquiredDate: asset.acquiredDate ? asset.acquiredDate.split('T')[0] : '',
        purchasePrice: asset.purchasePrice || '',
        supplierId: asset.supplierId || '',
        orderNumber: asset.orderNumber || '',
        hostname: asset.hostname || '',
        deviceUsername: asset.deviceUsername || '',
        devicePassword: asset.devicePassword || '',
        lanMacAddress: asset.lanMacAddress || '',
        wlanMacAddress: asset.wlanMacAddress || '',
        ipAddress: asset.ipAddress || '',
        assignedTo: asset.assignedTo || '',
        locationId: asset.locationId || '',
        warrantyExpiration: asset.warrantyExpiration ? asset.warrantyExpiration.split('T')[0] : '',
        endOfLifeDate: asset.endOfLifeDate ? asset.endOfLifeDate.split('T')[0] : '',
        lastReviewDate: asset.lastReviewDate ? asset.lastReviewDate.split('T')[0] : '',
        decommissionDate: asset.decommissionDate ? asset.decommissionDate.split('T')[0] : '',
        comments: asset.comments || ''
      });
    }
  }, [asset, reset]);

  // Auto-set decommission date when status changes to Decommissioned
  useEffect(() => {
    if (status && status.startsWith('Decommissioned')) {
      const today = new Date().toISOString().split('T')[0];
      setValue('decommissionDate', today);
    }
  }, [status, setValue]);

  const createMutation = useMutation({
    mutationFn: (data: Partial<Asset>) => api.createAsset(data),
    onSuccess: (newAsset) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      navigate(`/assets/${newAsset.id}`);
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Asset>) => api.updateAsset(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['asset', id] });
      navigate(`/assets/${id}`);
    }
  });

  const onSubmit = (data: AssetFormData) => {
    // Clean up empty strings to null
    const cleanData: Record<string, any> = {};
    Object.entries(data).forEach(([key, value]) => {
      cleanData[key] = value === '' ? null : value;
    });

    if (isEditing) {
      updateMutation.mutate(cleanData);
    } else {
      createMutation.mutate(cleanData);
    }
  };

  const mutation = isEditing ? updateMutation : createMutation;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to={isEditing ? `/assets/${id}` : '/assets'} className="p-2 rounded-md hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {isEditing ? 'Edit Asset' : 'Add New Asset'}
        </h1>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {mutation.error && (
          <div className="rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-700">{(mutation.error as Error).message}</p>
          </div>
        )}

        {/* Basic Info */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Basic Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Item Number *</label>
              <input
                {...register('itemNumber', { required: 'Item number is required' })}
                className="input"
                placeholder="e.g., AST-001"
              />
              {errors.itemNumber && (
                <p className="mt-1 text-sm text-red-600">{errors.itemNumber.message}</p>
              )}
            </div>
            <div>
              <label className="label">Serial Number</label>
              <input {...register('serialNumber')} className="input" />
            </div>
            <div>
              <label className="label">Manufacturer</label>
              <select {...register('manufacturerId')} className="input">
                <option value="">Select manufacturer...</option>
                {manufacturers?.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Model</label>
              <input {...register('model')} className="input" />
            </div>
            <div>
              <label className="label">Category</label>
              <select {...register('categoryId')} className="input">
                <option value="">Select category...</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select {...register('status')} className="input">
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Condition</label>
              <select {...register('condition')} className="input">
                {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Description</label>
              <textarea {...register('description')} className="input" rows={3} />
            </div>
          </div>
        </div>

        {/* Assignment & Location */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Assignment & Location</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Assigned To</label>
              <input {...register('assignedTo')} className="input" placeholder="Name or department" />
            </div>
            <div>
              <label className="label">Location</label>
              <select {...register('locationId')} className="input">
                <option value="">Select location...</option>
                {locations?.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Device Details */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Device Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Hostname</label>
              <input {...register('hostname')} className="input" />
            </div>
            <div>
              <label className="label">IP Address</label>
              <input {...register('ipAddress')} className="input" placeholder="192.168.1.1" />
            </div>
            <div>
              <label className="label">LAN MAC Address</label>
              <input {...register('lanMacAddress')} className="input" placeholder="00:00:00:00:00:00" />
            </div>
            <div>
              <label className="label">WLAN MAC Address</label>
              <input {...register('wlanMacAddress')} className="input" placeholder="00:00:00:00:00:00" />
            </div>
            <div>
              <label className="label">Device Username</label>
              <input {...register('deviceUsername')} className="input" />
            </div>
            <div>
              <label className="label">Device Password</label>
              <input {...register('devicePassword')} type="password" className="input" />
            </div>
          </div>
        </div>

        {/* Purchase Info */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Purchase Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Acquired Date</label>
              <input {...register('acquiredDate')} type="date" className="input" />
            </div>
            <div>
              <label className="label">Purchase Price</label>
              <input {...register('purchasePrice')} type="number" step="0.01" className="input" />
            </div>
            <div>
              <label className="label">Supplier</label>
              <select {...register('supplierId')} className="input">
                <option value="">Select supplier...</option>
                {suppliers?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Order Number</label>
              <input {...register('orderNumber')} className="input" />
            </div>
          </div>
        </div>

        {/* Lifecycle */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Lifecycle</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Warranty Expiration</label>
              <input {...register('warrantyExpiration')} type="date" className="input" />
            </div>
            <div>
              <label className="label">End of Life Date</label>
              <input {...register('endOfLifeDate')} type="date" className="input" />
            </div>
            <div>
              <label className="label">Last Review Date</label>
              <input {...register('lastReviewDate')} type="date" className="input" />
            </div>
            <div>
              <label className="label">Decommission Date</label>
              <input {...register('decommissionDate')} type="date" className="input" />
            </div>
          </div>
        </div>

        {/* Comments */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Comments</h2>
          <textarea {...register('comments')} className="input" rows={4} />
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-4">
          <Link
            to={isEditing ? `/assets/${id}` : '/assets'}
            className="btn btn-secondary"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || mutation.isPending}
            className="btn btn-primary"
          >
            <Save className="w-4 h-4 mr-2" />
            {mutation.isPending ? 'Saving...' : (isEditing ? 'Update Asset' : 'Create Asset')}
          </button>
        </div>
      </form>
    </div>
  );
}
