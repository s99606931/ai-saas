// Design Ref: DESIGN-MTU-U1-P §B — DataGrid 유기체 컴포넌트
// Plan SC: FR-UP.11

'use client';

import { useState } from 'react';

interface Column<T> {
  key: keyof T & string;
  label: string;
  sortable?: boolean;
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

interface DataGridProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  pageSize?: number;
  onRowClick?: (row: T) => void;
}

type SortDirection = 'asc' | 'desc' | null;

export function DataGrid<T extends Record<string, unknown>>({
  columns,
  data,
  pageSize = 10,
  onRowClick,
}: DataGridProps<T>) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [filter, setFilter] = useState('');

  // 필터
  const filtered = data.filter((row) =>
    Object.values(row).some((val) =>
      String(val).toLowerCase().includes(filter.toLowerCase()),
    ),
  );

  // 정렬
  const sorted = sortKey
    ? [...filtered].sort((a, b) => {
        const aVal = String(a[sortKey] ?? '');
        const bVal = String(b[sortKey] ?? '');
        const cmp = aVal.localeCompare(bVal, 'ko');
        return sortDir === 'desc' ? -cmp : cmp;
      })
    : filtered;

  // 페이지네이션
  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'));
      if (sortDir === 'desc') setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <div>
      {/* 필터 입력 */}
      <div className="mb-3">
        <input
          type="text"
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setPage(0); }}
          placeholder="검색..."
          className="px-3 py-2 text-sm border rounded-lg w-full max-w-xs"
          style={{
            borderColor: 'var(--color-border)',
            color: 'var(--color-text)',
            backgroundColor: 'var(--color-bg)',
          }}
          aria-label="테이블 검색"
        />
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto border rounded-lg" style={{ borderColor: 'var(--color-border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left font-medium"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {col.sortable ? (
                    <button
                      onClick={() => handleSort(col.key)}
                      className="flex items-center gap-1"
                      aria-label={`${col.label} 정렬`}
                    >
                      {col.label}
                      <span className="text-xs">
                        {sortKey === col.key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((row, i) => (
              <tr
                key={i}
                className="border-t hover:opacity-90 transition-colors"
                style={{
                  borderColor: 'var(--color-border)',
                  cursor: onRowClick ? 'pointer' : undefined,
                }}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3" style={{ color: 'var(--color-text)' }}>
                    {col.render ? col.render(row[col.key], row) : String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            전체 {sorted.length}건 중 {page * pageSize + 1}~{Math.min((page + 1) * pageSize, sorted.length)}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 text-sm border rounded disabled:opacity-30"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              aria-label="이전 페이지"
            >
              ◀
            </button>
            <span className="px-2 py-1 text-sm" style={{ color: 'var(--color-text)' }}>
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 text-sm border rounded disabled:opacity-30"
              style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
              aria-label="다음 페이지"
            >
              ▶
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
