// Molecule 컴포넌트 타입
// Design Ref: D-P00.5

import type { ReactNode } from 'react';

export interface DataTableProps<T = unknown> {
  data: T[];
  columns: DataTableColumn<T>[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
  };
  onPageChange?: (page: number) => void;
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  loading?: boolean;
}

export interface DataTableColumn<T = unknown> {
  key: string;
  header: string;
  render?: (value: unknown, row: T) => ReactNode;
  sortable?: boolean;
  width?: string;
}

export interface FormFieldProps {
  label: string;
  name: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: ReactNode;
}

export interface StatusCardProps {
  title: string;
  value: string | number;
  icon?: ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
  };
  className?: string;
}
