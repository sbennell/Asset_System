import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | null): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString();
}

export function formatCurrency(value: string | number | null): string {
  if (value === null || value === undefined) return '-';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(num);
}

export const STATUS_LABELS: Record<string, string> = {
  'In Use': 'In Use',
  'In Use - Loaned to student': 'In Use - Loaned to student',
  'In Use - Loaned to staff': 'In Use - Loaned to staff',
  'Awaiting allocation': 'Awaiting allocation',
  'Awaiting delivery': 'Awaiting delivery',
  'Awaiting collection': 'Awaiting collection',
  'Decommissioned - Beyond service age': 'Decommissioned - Beyond service age',
  'Decommissioned - Damaged': 'Decommissioned - Damaged',
  'Decommissioned - Stolen': 'Decommissioned - Stolen',
  'Decommissioned - In storage': 'Decommissioned - In storage',
  'Decommissioned - User left school': 'Decommissioned - User left school',
  'Decommissioned - Written Off': 'Decommissioned - Written Off',
  'Decommissioned - Unreturned': 'Decommissioned - Unreturned',
  'Retired - Uncollected': 'Retired - Uncollected',
  'Retired - Lost': 'Retired - Lost'
};

export const CONDITION_LABELS: Record<string, string> = {
  NEW: 'New',
  EXCELLENT: 'Excellent',
  GOOD: 'Good',
  FAIR: 'Fair',
  POOR: 'Poor',
  NON_FUNCTIONAL: 'Non-functional'
};

export const STATUS_COLORS: Record<string, string> = {
  'In Use': 'bg-green-100 text-green-800',
  'In Use - Loaned to student': 'bg-green-100 text-green-800',
  'In Use - Loaned to staff': 'bg-green-100 text-green-800',
  'Awaiting allocation': 'bg-yellow-100 text-yellow-800',
  'Awaiting delivery': 'bg-yellow-100 text-yellow-800',
  'Awaiting collection': 'bg-yellow-100 text-yellow-800',
  'Decommissioned - Beyond service age': 'bg-gray-100 text-gray-800',
  'Decommissioned - Damaged': 'bg-gray-100 text-gray-800',
  'Decommissioned - Stolen': 'bg-red-100 text-red-800',
  'Decommissioned - In storage': 'bg-gray-100 text-gray-800',
  'Decommissioned - User left school': 'bg-gray-100 text-gray-800',
  'Decommissioned - Written Off': 'bg-gray-100 text-gray-800',
  'Decommissioned - Unreturned': 'bg-orange-100 text-orange-800',
  'Retired - Uncollected': 'bg-red-100 text-red-800',
  'Retired - Lost': 'bg-red-100 text-red-800'
};
