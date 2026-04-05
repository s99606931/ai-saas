// Design Ref: DESIGN-MTU-P17 — 테넌트 대시보드
import { AppShell } from '@/components/layout/AppShell';
import { TenantPageTemplate } from '@/components/tenant/TenantPageTemplate';

export default function TenantDashboardPage() {
  return (
    <AppShell>
      <TenantPageTemplate title="대시보드" description="구독 서비스 현황을 확인하세요.">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>활성 서비스</p>
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-primary)' }}>3</p>
          </div>
          <div className="border rounded-lg p-4" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>사용자 수</p>
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-success)' }}>42</p>
          </div>
          <div className="border rounded-lg p-4" style={{ borderColor: 'var(--color-border)' }}>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>AI 사용량</p>
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-warning)' }}>1,234건</p>
          </div>
        </div>
      </TenantPageTemplate>
    </AppShell>
  );
}
