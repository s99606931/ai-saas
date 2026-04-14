/**
 * DS-MOL-R2 — DataTable 분자 컴포넌트
 * Design Ref: docs/02-design/mtus/DS-MOL-R2.design.md §1
 * Plan SC: FR-DSM.11, FR-DSM.11.1, FR-DSM.11.2, FR-DSM.11.3
 *
 * 제네릭 테이블. 정렬·페이지네이션·선택·loading·빈 상태 지원.
 * semantic <table> + aria-sort.
 */

import { useId, type ReactNode } from 'react';
import { cn } from '../../atoms/lib/cn.js';
import { Button } from '../../atoms/Button/index.js';
import { Spinner } from '../../atoms/Spinner/index.js';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  accessor?: (row: T) => unknown;
  render?: (value: unknown, row: T, index: number) => ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface DataTablePagination {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export interface DataTableSelection {
  mode: 'single' | 'multi';
  selectedKeys: string[];
  onSelectionChange: (keys: string[]) => void;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  /** React key 추출: T의 key 또는 함수 */
  rowKey: keyof T | ((row: T) => string);
  loading?: boolean;
  emptyMessage?: ReactNode;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  pagination?: DataTablePagination;
  selection?: DataTableSelection;
  className?: string;
  'aria-label'?: string;
}

function getRowKey<T>(
  row: T,
  rowKey: DataTableProps<T>['rowKey']
): string {
  if (typeof rowKey === 'function') return rowKey(row);
  return String((row as Record<string, unknown>)[rowKey as string]);
}

function getCellValue<T>(row: T, column: DataTableColumn<T>): unknown {
  if (column.accessor) return column.accessor(row);
  return (row as Record<string, unknown>)[column.key];
}

export function DataTable<T>({
  data,
  columns,
  rowKey,
  loading = false,
  emptyMessage = '데이터가 없습니다.',
  sortKey,
  sortDirection,
  onSort,
  pagination,
  selection,
  className,
  'aria-label': ariaLabel,
}: DataTableProps<T>) {
  const tableId = useId();

  const handleSort = (column: DataTableColumn<T>) => {
    if (!column.sortable || !onSort) return;
    const nextDir: 'asc' | 'desc' =
      sortKey === column.key && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(column.key, nextDir);
  };

  const ariaSort = (column: DataTableColumn<T>): 'ascending' | 'descending' | 'none' | undefined => {
    if (!column.sortable) return undefined;
    if (sortKey !== column.key) return 'none';
    return sortDirection === 'asc' ? 'ascending' : 'descending';
  };

  const allKeys = data.map((row) => getRowKey(row, rowKey));
  const allSelected =
    selection !== undefined &&
    selection.mode === 'multi' &&
    allKeys.length > 0 &&
    allKeys.every((k) => selection.selectedKeys.includes(k));

  const toggleAll = () => {
    if (!selection || selection.mode !== 'multi') return;
    selection.onSelectionChange(allSelected ? [] : allKeys);
  };

  const toggleRow = (key: string) => {
    if (!selection) return;
    if (selection.mode === 'single') {
      selection.onSelectionChange([key]);
    } else {
      const next = selection.selectedKeys.includes(key)
        ? selection.selectedKeys.filter((k) => k !== key)
        : [...selection.selectedKeys, key];
      selection.onSelectionChange(next);
    }
  };

  const totalColumns = columns.length + (selection ? 1 : 0);
  const totalPages = pagination
    ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize))
    : 1;

  return (
    <div className={cn('w-full', className)}>
      <div className="w-full overflow-x-auto">
        <table
          role="table"
          aria-label={ariaLabel}
          aria-busy={loading || undefined}
          id={tableId}
          className={cn(
            'w-full border-collapse',
            'text-[length:var(--font-size-sm)]',
            'text-[var(--color-on-surface)]'
          )}
        >
          <thead>
            <tr className="border-b border-[var(--color-outline-variant)]">
              {selection && selection.mode === 'multi' && (
                <th scope="col" className="w-10 p-[var(--space-2)]">
                  <input
                    type="checkbox"
                    aria-label="모두 선택"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="h-4 w-4 cursor-pointer"
                  />
                </th>
              )}
              {selection && selection.mode === 'single' && (
                <th scope="col" className="w-10 p-[var(--space-2)]" aria-label="선택" />
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  aria-sort={ariaSort(col)}
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    'p-[var(--space-2)]',
                    'font-[var(--font-weight-semibold)]',
                    'text-[var(--color-on-surface)]',
                    col.align === 'center' && 'text-center',
                    col.align === 'right' && 'text-right',
                    (!col.align || col.align === 'left') && 'text-left'
                  )}
                >
                  {col.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSort(col)}
                      className={cn(
                        'inline-flex items-center gap-1',
                        'hover:text-[var(--color-primary)]',
                        'focus-visible:outline-none',
                        'focus-visible:ring-2',
                        'focus-visible:ring-[var(--color-focus-ring)]',
                        'rounded-sm'
                      )}
                    >
                      {col.header}
                      <span aria-hidden="true" className="text-xs">
                        {sortKey === col.key
                          ? sortDirection === 'asc'
                            ? '▲'
                            : '▼'
                          : '↕'}
                      </span>
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td
                  colSpan={totalColumns}
                  className="p-[var(--space-6)] text-center"
                >
                  <span className="inline-flex items-center gap-2">
                    <Spinner size="sm" label="로딩 중" />
                    <span className="text-[var(--color-on-surface-muted)]">
                      불러오는 중...
                    </span>
                  </span>
                </td>
              </tr>
            )}
            {!loading && data.length === 0 && (
              <tr>
                <td
                  colSpan={totalColumns}
                  className="p-[var(--space-6)] text-center text-[var(--color-on-surface-muted)]"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
            {!loading &&
              data.map((row, rowIndex) => {
                const key = getRowKey(row, rowKey);
                const isSelected = selection?.selectedKeys.includes(key);
                return (
                  <tr
                    key={key}
                    aria-selected={isSelected || undefined}
                    className={cn(
                      'border-b border-[var(--color-outline-variant)]',
                      'hover:bg-[var(--color-surface-alt)]',
                      isSelected && 'bg-[var(--color-surface-alt)]'
                    )}
                  >
                    {selection && (
                      <td className="w-10 p-[var(--space-2)]">
                        <input
                          type={selection.mode === 'multi' ? 'checkbox' : 'radio'}
                          name={
                            selection.mode === 'single'
                              ? `${tableId}-selection`
                              : undefined
                          }
                          aria-label={`행 ${rowIndex + 1} 선택`}
                          checked={isSelected}
                          onChange={() => toggleRow(key)}
                          className="h-4 w-4 cursor-pointer"
                        />
                      </td>
                    )}
                    {columns.map((col) => {
                      const value = getCellValue(row, col);
                      return (
                        <td
                          key={col.key}
                          className={cn(
                            'p-[var(--space-2)]',
                            col.align === 'center' && 'text-center',
                            col.align === 'right' && 'text-right'
                          )}
                        >
                          {col.render
                            ? col.render(value, row, rowIndex)
                            : (value as ReactNode)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div
          className={cn(
            'mt-[var(--space-3)] flex items-center justify-between',
            'text-[length:var(--font-size-sm)] text-[var(--color-on-surface-muted)]'
          )}
        >
          <span>
            총 {pagination.total}건 — 페이지 {pagination.page} / {totalPages}
          </span>
          <span className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPageChange(pagination.page - 1)}
              aria-label="이전 페이지"
            >
              이전
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={pagination.page >= totalPages}
              onClick={() => pagination.onPageChange(pagination.page + 1)}
              aria-label="다음 페이지"
            >
              다음
            </Button>
          </span>
        </div>
      )}
    </div>
  );
}

DataTable.displayName = 'DataTable';
