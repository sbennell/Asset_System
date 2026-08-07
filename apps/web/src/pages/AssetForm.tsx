import { useEffect, useState } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Save, Trash2, Plus } from 'lucide-react';
import { api, Asset, StudentSummary } from '../lib/api';
import {
  STATUS_LABELS,
  CONDITION_LABELS,
  CRITICALITY_LABELS,
  DATA_CLASSIFICATION_LABELS,
  HOSTING_LABELS,
  SUPPORT_LABELS
} from '../lib/utils';
import StudentSearchCombobox from '../components/StudentSearchCombobox';
import FieldLabel from '../components/FieldLabel';
import { useAuth } from '../App';

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
  assignedTo: string;
  studentId: string;
  locationId: string;
  warrantyExpiration: string;
  endOfLifeDate: string;
  lastReviewDate: string;
  decommissionDate: string;
  comments: string;
  businessPurpose: string;
  businessOwner: string;
  technicalOwner: string;
  version: string;
  criticalityTier: string;
  dataClassification: string;
  hostingType: string;
  supportType: string;
  internetFacing: string;
};

export default function AssetForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { hasPermission } = useAuth();
  const isEditing = !!id;
  const duplicateFromId = searchParams.get('duplicateFrom');

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<AssetFormData>({
    defaultValues: {
      status: 'In Use',
      condition: 'GOOD'
    }
  });

  const status = watch('status');
  const [newIpAddress, setNewIpAddress] = useState('');
  const [newIpLabel, setNewIpLabel] = useState('');
  const [assignmentMode, setAssignmentMode] = useState<'student' | 'staff'>('staff');
  const [selectedStudent, setSelectedStudent] = useState<Partial<StudentSummary> | null>(null);

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

  // Fetch source asset when duplicating
  const { data: duplicateSource } = useQuery({
    queryKey: ['asset', duplicateFromId],
    queryFn: () => api.getAsset(duplicateFromId!),
    enabled: !isEditing && !!duplicateFromId
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

  // Prefill IP address from query parameter
  useEffect(() => {
    if (!isEditing) {
      const ip = searchParams.get('ip');
      if (ip) {
        setNewIpAddress(ip);
      }
    }
  }, [isEditing, searchParams]);

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
        assignedTo: asset.assignedTo || '',
        studentId: asset.studentId || '',
        locationId: asset.locationId || '',
        warrantyExpiration: asset.warrantyExpiration ? asset.warrantyExpiration.split('T')[0] : '',
        endOfLifeDate: asset.endOfLifeDate ? asset.endOfLifeDate.split('T')[0] : '',
        lastReviewDate: asset.lastReviewDate ? asset.lastReviewDate.split('T')[0] : '',
        decommissionDate: asset.decommissionDate ? asset.decommissionDate.split('T')[0] : '',
        comments: asset.comments || '',
        businessPurpose: asset.businessPurpose || '',
        businessOwner: asset.businessOwner || '',
        technicalOwner: asset.technicalOwner || '',
        version: asset.version || '',
        criticalityTier: asset.criticalityTier || '',
        dataClassification: asset.dataClassification || '',
        hostingType: asset.hostingType || '',
        supportType: asset.supportType || '',
        internetFacing: asset.internetFacing === null || asset.internetFacing === undefined ? '' : String(asset.internetFacing)
      });

      // Initialize assignment mode based on whether studentId is set
      if (asset.studentId && asset.student) {
        setAssignmentMode('student');
        setSelectedStudent(asset.student);
      } else {
        setAssignmentMode('staff');
        setSelectedStudent(null);
      }
    }
  }, [asset, reset]);

  // Populate form from source asset when duplicating
  useEffect(() => {
    if (duplicateSource && !isEditing) {
      reset({
        manufacturerId: duplicateSource.manufacturerId || '',
        model: duplicateSource.model || '',
        categoryId: duplicateSource.categoryId || '',
        description: duplicateSource.description || '',
        status: duplicateSource.status || 'In Use',
        condition: duplicateSource.condition || 'GOOD',
        acquiredDate: duplicateSource.acquiredDate ? duplicateSource.acquiredDate.split('T')[0] : '',
        purchasePrice: duplicateSource.purchasePrice || '',
        supplierId: duplicateSource.supplierId || '',
        orderNumber: duplicateSource.orderNumber || '',
        warrantyExpiration: duplicateSource.warrantyExpiration ? duplicateSource.warrantyExpiration.split('T')[0] : '',
        endOfLifeDate: duplicateSource.endOfLifeDate ? duplicateSource.endOfLifeDate.split('T')[0] : '',
        comments: duplicateSource.comments || '',
        businessPurpose: duplicateSource.businessPurpose || '',
        businessOwner: duplicateSource.businessOwner || '',
        technicalOwner: duplicateSource.technicalOwner || '',
        version: duplicateSource.version || '',
        criticalityTier: duplicateSource.criticalityTier || '',
        dataClassification: duplicateSource.dataClassification || '',
        hostingType: duplicateSource.hostingType || '',
        supportType: duplicateSource.supportType || '',
        internetFacing: duplicateSource.internetFacing === null || duplicateSource.internetFacing === undefined ? '' : String(duplicateSource.internetFacing)
      });

      // Re-apply the auto-generated item number, since reset() above cleared it
      if (nextItemData?.nextItemNumber) {
        setValue('itemNumber', nextItemData.nextItemNumber);
      }

      setAssignmentMode('staff');
      setSelectedStudent(null);
    }
  }, [duplicateSource, isEditing, reset, nextItemData, setValue]);

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

  const deleteIPMutation = useMutation({
    mutationFn: (ipId: string) => api.deleteAssetIP(id!, ipId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset', id] });
    }
  });

  const addIPMutation = useMutation({
    mutationFn: (data: { ip: string; label?: string }) => api.addAssetIP(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset', id] });
      setNewIpAddress('');
      setNewIpLabel('');
    }
  });

  const handleDeleteIP = (ipId: string, ip: string) => {
    if (window.confirm(`Remove IP address ${ip}?`)) {
      deleteIPMutation.mutate(ipId);
    }
  };

  const handleAddIP = () => {
    if (!newIpAddress.trim()) {
      alert('Please enter an IP address');
      return;
    }
    addIPMutation.mutate({
      ip: newIpAddress,
      label: newIpLabel || undefined
    });
  };

  const onSubmit = (data: AssetFormData) => {
    // Clean up empty strings to null
    const cleanData: Record<string, any> = {};
    Object.entries(data).forEach(([key, value]) => {
      cleanData[key] = value === '' ? null : value;
    });

    // Tri-state (Unknown/Yes/No) field: convert the string back to a nullable boolean
    cleanData.internetFacing = data.internetFacing === '' ? null : data.internetFacing === 'true';

    // Without canViewDevicePasswords, the field was never populated with the real value
    // (the API redacts it to null) - omit it entirely so an unrelated save doesn't
    // wipe the actual stored password.
    if (!hasPermission('canViewDevicePasswords')) {
      delete cleanData.devicePassword;
    }

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
        {duplicateSource && (
          <div className="rounded-md bg-blue-50 p-4">
            <p className="text-sm text-blue-700">
              Duplicating details from asset <strong>{duplicateSource.itemNumber}</strong>. Serial number,
              assignment, location, hostname, MAC addresses, and device credentials were left blank for you
              to fill in for this asset.
            </p>
          </div>
        )}
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
              <FieldLabel text="Item Number" required help="Unique identifier for this asset, used on printed labels, QR codes, and in the asset register export." />
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
              <FieldLabel text="Serial Number" help="The manufacturer-assigned serial number, usually printed on a sticker on the device." />
              <input {...register('serialNumber')} className="input" />
            </div>
            <div>
              <FieldLabel text="Manufacturer" help="The company that made this asset." />
              <select {...register('manufacturerId')} className="input">
                <option value="">Select manufacturer...</option>
                {manufacturers?.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel text="Model" help="The manufacturer's model name or number." />
              <input {...register('model')} className="input" />
            </div>
            <div>
              <FieldLabel text="Category" help="The type of asset (e.g. Laptop, Desktop, Server). Also used as the asset's Type in the MACS asset register export." />
              <select {...register('categoryId')} className="input">
                <option value="">Select category...</option>
                {categories?.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel text="Status" help="The asset's current lifecycle status (e.g. Planned, In Use, Decommissioned)." />
              <select {...register('status')} className="input">
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel text="Condition" help="The asset's physical condition." />
              <select {...register('condition')} className="input">
                {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <FieldLabel text="Description" help="Free-text description of the asset." />
              <textarea {...register('description')} className="input" rows={3} />
            </div>
          </div>
        </div>

        {/* Assignment & Location */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Assignment & Location</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <FieldLabel text="Assigned To" help="The student or staff member currently using this asset." />
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    setAssignmentMode('student');
                    setValue('assignedTo', '');
                  }}
                  className={`px-3 py-2 rounded font-medium text-sm ${
                    assignmentMode === 'student'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Student
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAssignmentMode('staff');
                    setSelectedStudent(null);
                  }}
                  className={`px-3 py-2 rounded font-medium text-sm ${
                    assignmentMode === 'staff'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Staff / Other
                </button>
              </div>

              {assignmentMode === 'student' ? (
                <StudentSearchCombobox
                  value={selectedStudent}
                  onChange={(student) => {
                    setSelectedStudent(student);
                    setValue('studentId', student?.id || '');
                    setValue('assignedTo', '');
                  }}
                  placeholder="Search for student..."
                />
              ) : (
                <input
                  {...register('assignedTo')}
                  className="input w-full"
                  placeholder="Name or department"
                  onChange={(e) => {
                    register('assignedTo').onChange(e);
                    setValue('studentId', '');
                    setSelectedStudent(null);
                  }}
                />
              )}
            </div>
            <div>
              <FieldLabel text="Location" help="Where the asset is physically located." />
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
              <FieldLabel text="Hostname" help="The device's network hostname." />
              <input {...register('hostname')} className="input" />
            </div>
            <div className="md:col-span-2">
              <FieldLabel text="IP Addresses" help="IP addresses currently linked to this device." />
              {/* Add New IP */}
              {isEditing && (
                <div className="mt-4 pt-4 border-t space-y-3">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newIpAddress}
                      onChange={(e) => setNewIpAddress(e.target.value)}
                      placeholder="e.g., 192.168.1.100"
                      className="input flex-1"
                    />
                    <input
                      type="text"
                      value={newIpLabel}
                      onChange={(e) => setNewIpLabel(e.target.value)}
                      placeholder="Label (optional)"
                      className="input flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleAddIP}
                      disabled={addIPMutation.isPending}
                      className="btn btn-primary whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add IP
                    </button>
                  </div>
                  {addIPMutation.error && (
                    <p className="text-sm text-red-600">{(addIPMutation.error as Error).message}</p>
                  )}
                </div>
              )}

              {/* IPs List */}
              {isEditing && asset?.ipAddresses && asset.ipAddresses.length > 0 && (
                <div className="space-y-2 mt-3 pt-3 border-t">
                  <p className="text-sm text-gray-600 font-medium">IP Addresses:</p>
                  {asset.ipAddresses.map((ipEntry) => (
                    <div key={ipEntry.id} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-sm font-mono text-gray-900">{ipEntry.ip}</span>
                        {ipEntry.label && <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">{ipEntry.label}</span>}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteIP(ipEntry.id, ipEntry.ip)}
                        disabled={deleteIPMutation.isPending}
                        className="ml-2 p-1 text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
                        title="Remove this IP"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <FieldLabel text="LAN MAC Address" help="The MAC address of the device's wired network adapter." />
              <input {...register('lanMacAddress')} className="input" placeholder="00:00:00:00:00:00" />
            </div>
            <div>
              <FieldLabel text="WLAN MAC Address" help="The MAC address of the device's wireless network adapter." />
              <input {...register('wlanMacAddress')} className="input" placeholder="00:00:00:00:00:00" />
            </div>
            <div>
              <FieldLabel text="Device Username" help="The login username for this device." />
              <input {...register('deviceUsername')} className="input" />
            </div>
            <div>
              <FieldLabel text="Device Password" help="The login password for this device. Only visible to users with password-view permission." />
              {hasPermission('canViewDevicePasswords') ? (
                <>
                  <input
                    {...register('devicePassword')}
                    type="password"
                    className="input"
                    placeholder={isEditing && asset?.devicePassword ? 'Modify or leave blank to keep existing' : 'Enter password'}
                    autoComplete={isEditing ? 'off' : 'new-password'}
                  />
                  {isEditing && asset?.devicePassword && (
                    <p className="mt-1 text-xs text-gray-500">
                      ✓ Password is set. Enter a new password to change it, or leave blank to keep existing.
                    </p>
                  )}
                </>
              ) : (
                <p className="input bg-gray-50 text-gray-400 italic flex items-center">Hidden</p>
              )}
            </div>
          </div>
        </div>

        {/* Purchase Info */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Purchase Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FieldLabel text="Acquired Date" help="The date this asset was purchased or received." />
              <input {...register('acquiredDate')} type="date" className="input" />
            </div>
            <div>
              <FieldLabel text="Purchase Price" help="What the school paid for this asset." />
              <input {...register('purchasePrice')} type="number" step="0.01" className="input" />
            </div>
            <div>
              <FieldLabel text="Supplier" help="The vendor this asset was purchased from." />
              <select {...register('supplierId')} className="input">
                <option value="">Select supplier...</option>
                {suppliers?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel text="Order Number" help="The purchase order or invoice reference number." />
              <input {...register('orderNumber')} className="input" />
            </div>
          </div>
        </div>

        {/* Lifecycle */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Lifecycle</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <FieldLabel text="Warranty Expiration" help="The date the manufacturer's warranty ends." />
              <input {...register('warrantyExpiration')} type="date" className="input" />
            </div>
            <div>
              <FieldLabel text="End of Life Date" help="The date the manufacturer stops supporting or patching this asset." />
              <input {...register('endOfLifeDate')} type="date" className="input" />
            </div>
            <div>
              <FieldLabel text="Last Review Date" help="The date this asset's record was last reviewed for accuracy. Update at least yearly to meet the MACS annual review requirement." />
              <input {...register('lastReviewDate')} type="date" className="input" />
            </div>
            <div>
              <FieldLabel text="Decommission Date" help="The date the asset was, or is planned to be, retired from service." />
              <input {...register('decommissionDate')} type="date" className="input" />
            </div>
          </div>
        </div>

        {/* Compliance / Governance */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Compliance / Governance</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <FieldLabel text="Business Purpose / Function" help="The business process or service this asset supports." />
              <textarea {...register('businessPurpose')} className="input" rows={2} />
            </div>
            <div>
              <FieldLabel text="Business Owner" help="The person or role accountable for this asset's business use (e.g. Principal, Business Manager)." />
              <input {...register('businessOwner')} className="input" placeholder="e.g., Principal, Business Manager" />
            </div>
            <div>
              <FieldLabel text="Technical Owner" help="The person or role responsible for this asset's technical upkeep (e.g. IT Coordinator)." />
              <input {...register('technicalOwner')} className="input" placeholder="e.g., IT Coordinator" />
            </div>
            <div>
              <FieldLabel text="Version" help="The software or firmware version currently installed, if applicable." />
              <input {...register('version')} className="input" />
            </div>
            <div>
              <FieldLabel text="Criticality" help="How severe the impact would be if this asset were compromised or unavailable. Critical means essential to core school operations or child safety." />
              <select {...register('criticalityTier')} className="input">
                <option value="">Not set</option>
                {Object.entries(CRITICALITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel text="Data Classification" help="The sensitivity of the most sensitive data this asset stores or processes." />
              <select {...register('dataClassification')} className="input">
                <option value="">Not set</option>
                {Object.entries(DATA_CLASSIFICATION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel text="Hosting" help="Where this asset (or the data/service it provides) is hosted." />
              <select {...register('hostingType')} className="input">
                <option value="">Not set</option>
                {Object.entries(HOSTING_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel text="Support Type" help="Who provides technical support for this asset." />
              <select {...register('supportType')} className="input">
                <option value="">Not set</option>
                {Object.entries(SUPPORT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel text="Internet Facing" help="Whether this asset is directly accessible from the internet." />
              <select {...register('internetFacing')} className="input">
                <option value="">Unknown</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>
        </div>

        {/* Comments */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Comments / Supporting Notes</h2>
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
