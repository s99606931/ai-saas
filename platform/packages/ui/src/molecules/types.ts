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

// NOTE: FormFieldProps는 molecules/FormField/index.tsx에서 실제 구현으로 export됨 (DS-MOL-R1)

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
