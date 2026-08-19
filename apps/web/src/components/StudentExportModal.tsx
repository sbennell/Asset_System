import { useState } from 'react';
import { Download, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../App';

interface StudentExportModalProps {
  onClose: () => void;
  filters: { search?: string; status?: string; schoolYear?: string; homeGroup?: string };
}

interface FieldOption {
  key: string;
  label: string;
}

// Keys must stay in sync with STUDENT_EXPORT_FIELDS / ASSET_EXPORT_FIELDS in
// apps/api/src/routes/students.ts
const STUDENT_FIELD_OPTIONS: FieldOption[] = [
  { key: 'firstName', label: 'First Name' },
  { key: 'surname', label: 'Surname' },
  { key: 'homeGroup', label: 'Home Group' },
  { key: 'schoolYear', label: 'Year Level' },
  { key: 'status', label: 'Status' },
  { key: 'email', label: 'Email' },
  { key: 'username', label: 'Username' },
  { key: 'edupassUsername', label: 'Edupass Username' },
  { key: 'birthdate', label: 'Birthdate' },
  { key: 'password', label: 'Password' }
];

const ASSET_FIELD_OPTIONS: FieldOption[] = [
  { key: 'itemNumber', label: 'Item Number' },
  { key: 'category', label: 'Category' },
  { key: 'manufacturer', label: 'Manufacturer' },
  { key: 'model', label: 'Model' },
  { key: 'serialNumber', label: 'Serial Number' },
  { key: 'description', label: 'Description' },
  { key: 'assetStatus', label: 'Asset Status' },
  { key: 'condition', label: 'Condition' },
  { key: 'location', label: 'Location' },
  { key: 'acquiredDate', label: 'Acquired Date' },
  { key: 'warrantyExpiration', label: 'Warranty Expiration' },
  { key: 'orderNumber', label: 'Order Number' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'comments', label: 'Comments' }
];

const DEFAULT_FIELDS = new Set([
  'firstName', 'surname', 'homeGroup', 'schoolYear', 'status', 'email',
  'itemNumber', 'category', 'manufacturer', 'model', 'serialNumber'
]);

export default function StudentExportModal({ onClose, filters }: StudentExportModalProps) {
  const { hasPermission } = useAuth();
  const canViewPasswords = hasPermission('canViewStudentPasswords');

  const studentFieldOptions = canViewPasswords
    ? STUDENT_FIELD_OPTIONS
    : STUDENT_FIELD_OPTIONS.filter((f) => f.key !== 'password');
  const allFieldKeys = [...studentFieldOptions, ...ASSET_FIELD_OPTIONS].map((f) => f.key);

  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(DEFAULT_FIELDS));

  const toggleField = (key: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelectedFields(new Set(allFieldKeys));
  const selectNone = () => setSelectedFields(new Set());

  const handleExport = () => {
    window.open(api.getStudentsExportUrl({ ...filters, fields: Array.from(selectedFields) }), '_blank');
    onClose();
  };

  const renderFieldGroup = (title: string, options: FieldOption[]) => (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {options.map((option) => (
          <label key={option.key} className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={selectedFields.has(option.key)}
              onChange={() => toggleField(option.key)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 z-40 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Export Students</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-gray-500 mb-4">
          Exports the currently filtered student list to Excel. Each row is one student's assigned
          asset (students with no assets, or if no asset fields are selected, get a single row).
        </p>

        {/* Select all / none */}
        <div className="flex gap-3 mb-4">
          <button type="button" onClick={selectAll} className="text-xs text-primary-600 hover:text-primary-800">
            Select All
          </button>
          <button type="button" onClick={selectNone} className="text-xs text-primary-600 hover:text-primary-800">
            Select None
          </button>
        </div>

        {/* Field selection */}
        <div className="space-y-4 mb-6">
          {renderFieldGroup('Student Fields', studentFieldOptions)}
          {renderFieldGroup('Asset Fields', ASSET_FIELD_OPTIONS)}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={selectedFields.size === 0}
            className="flex-1 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Download size={18} />
            Export
          </button>
        </div>
      </div>
    </div>
  );
}
