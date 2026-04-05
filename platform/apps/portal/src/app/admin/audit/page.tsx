// Design Ref: DESIGN-MTU-P16b — 감사 로그
import { AppShell } from '@/components/layout/AppShell';
import { AdminPageTemplate } from '@/components/admin/AdminPageTemplate';
import { DataGrid } from '@/components/common/DataGrid';

const SAMPLE_LOGS = [
  { id: '1', action: 'LOGIN_SUCCESS', actorId: 'admin', ip: '10.0.0.1', createdAt: '2026-04-05 14:00' },
  { id: '2', action: 'TENANT_CREATED', actorId: 'admin', ip: '10.0.0.1', createdAt: '2026-04-05 14:05' },
  { id: '3', action: 'USER_CREATED', actorId: 'admin', ip: '10.0.0.1', createdAt: '2026-04-05 14:10' },
];

export default function AuditPage() {
  return (
    <AppShell>
      <AdminPageTemplate title="감사 로그" description="시스템 감사 로그를 조회합니다.">
        <DataGrid
          columns={[
            { key: 'action', label: '작업', sortable: true },
            { key: 'actorId', label: '수행자' },
            { key: 'ip', label: 'IP 주소' },
            { key: 'createdAt', label: '일시', sortable: true },
          ]}
          data={SAMPLE_LOGS}
        />
      </AdminPageTemplate>
    </AppShell>
  );
}
