// Design Ref: DESIGN-MTU-P16a — 사용자 관리
import { AppShell } from '@/components/layout/AppShell';
import { AdminPageTemplate } from '@/components/admin/AdminPageTemplate';
import { DataGrid } from '@/components/common/DataGrid';

const SAMPLE_USERS = [
  { id: '1', name: '관리자', email: 'admin@gov.kr', role: 'SUPER_ADMIN', status: 'ACTIVE', tenant: '플랫폼' },
  { id: '2', name: '김담당', email: 'kim@seoul.go.kr', role: 'TENANT_ADMIN', status: 'ACTIVE', tenant: '서울시청' },
  { id: '3', name: '이사용', email: 'lee@busan.go.kr', role: 'USER', status: 'ACTIVE', tenant: '부산시청' },
];

export default function UsersPage() {
  return (
    <AppShell>
      <AdminPageTemplate title="사용자 관리" description="전체 사용자 계정을 관리합니다.">
        <DataGrid
          columns={[
            { key: 'name', label: '이름', sortable: true },
            { key: 'email', label: '이메일' },
            { key: 'role', label: '역할', sortable: true },
            { key: 'status', label: '상태', sortable: true },
            { key: 'tenant', label: '테넌트', sortable: true },
          ]}
          data={SAMPLE_USERS}
        />
      </AdminPageTemplate>
    </AppShell>
  );
}
