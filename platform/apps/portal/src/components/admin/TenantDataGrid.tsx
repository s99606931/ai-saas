// Design Ref: DESIGN-MTU-U1-P §D — 테넌트 관리 DataGrid
// Plan SC: FR-UP.4, FR-UP.11

'use client';

import { DataGrid } from '../common/DataGrid';

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: string;
  userCount: number;
  createdAt: string;
}

const SAMPLE_TENANTS: TenantRow[] = [
  { id: '1', name: '서울시청', slug: 'seoul', status: 'ACTIVE', plan: 'Enterprise', userCount: 150, createdAt: '2026-01-15' },
  { id: '2', name: '부산시청', slug: 'busan', status: 'ACTIVE', plan: 'Standard', userCount: 80, createdAt: '2026-02-20' },
  { id: '3', name: '국세청', slug: 'nts', status: 'ACTIVE', plan: 'Enterprise', userCount: 300, createdAt: '2026-01-10' },
  { id: '4', name: '환경부', slug: 'moe', status: 'TRIAL', plan: 'Trial', userCount: 10, createdAt: '2026-04-01' },
];

export function TenantDataGrid() {
  return (
    <DataGrid<TenantRow>
      columns={[
        { key: 'name', label: '테넌트명', sortable: true },
        { key: 'slug', label: 'Slug' },
        {
          key: 'status',
          label: '상태',
          sortable: true,
          render: (val) => {
            const color = val === 'ACTIVE' ? 'var(--color-success)' : 'var(--color-warning)';
            return <span style={{ color }}>{String(val)}</span>;
          },
        },
        { key: 'plan', label: '요금제', sortable: true },
        { key: 'userCount', label: '사용자 수', sortable: true },
        { key: 'createdAt', label: '등록일', sortable: true },
      ]}
      data={SAMPLE_TENANTS}
      pageSize={10}
    />
  );
}
