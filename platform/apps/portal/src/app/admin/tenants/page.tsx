// Design Ref: DESIGN-MTU-P16a — 테넌트 관리
import { AppShell } from '@/components/layout/AppShell';
import { AdminPageTemplate } from '@/components/admin/AdminPageTemplate';
import { TenantDataGrid } from '@/components/admin/TenantDataGrid';

export default function TenantsPage() {
  return (
    <AppShell>
      <AdminPageTemplate
        title="테넌트 관리"
        description="플랫폼에 등록된 테넌트를 관리합니다."
      >
        <TenantDataGrid />
      </AdminPageTemplate>
    </AppShell>
  );
}
