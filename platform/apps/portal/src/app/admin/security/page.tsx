// Design Ref: DESIGN-MTU-P16b — 보안 모니터링
import { AppShell } from '@/components/layout/AppShell';
import { AdminPageTemplate } from '@/components/admin/AdminPageTemplate';

export default function AdminSecurityPage() {
  return (
    <AppShell>
      <AdminPageTemplate title="보안 모니터링" description="보안 이벤트, IP 차단, 이상 탐지">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border rounded-lg p-4" style={{ borderColor: 'var(--color-border)' }}>
            <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
              보안 알림
            </h3>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              미확인 알림: 0건
            </p>
          </div>
          <div className="border rounded-lg p-4" style={{ borderColor: 'var(--color-border)' }}>
            <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>
              IP 차단
            </h3>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              차단 IP: 0건
            </p>
          </div>
        </div>
      </AdminPageTemplate>
    </AppShell>
  );
}
