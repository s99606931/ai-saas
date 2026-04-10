// Design Ref: DESIGN-MTU-P16b — CRM 관리
import { AppShell } from '@/components/layout/AppShell';
import { AdminPageTemplate } from '@/components/admin/AdminPageTemplate';

export default function AdminCrmPage() {
  return (
    <AppShell>
      <AdminPageTemplate title="CRM 관리" description="고객 관계 관리 대시보드">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              고객사
            </p>
            <p className="text-2xl font-bold" style={{ color: 'var(--color-primary)' }}>
              24
            </p>
          </div>
          <div className="border rounded-lg p-4" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              계약
            </p>
            <p className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>
              18
            </p>
          </div>
          <div className="border rounded-lg p-4" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              파이프라인
            </p>
            <p className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>
              7
            </p>
          </div>
        </div>
      </AdminPageTemplate>
    </AppShell>
  );
}
