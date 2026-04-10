// Design Ref: DESIGN-MTU-P17 — 구독 서비스 허브
import { AppShell } from '@/components/layout/AppShell';
import { TenantPageTemplate } from '@/components/tenant/TenantPageTemplate';

export default function TenantServicesPage() {
  return (
    <AppShell>
      <TenantPageTemplate title="구독 서비스" description="활성화된 서비스를 관리하세요.">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: '전자결재', status: '활성', usage: '85%' },
            { name: '인사관리', status: '활성', usage: '72%' },
            { name: 'AI 업무지원', status: '활성', usage: '45%' },
          ].map((s) => (
            <div key={s.name} className="border rounded-lg p-4" style={{ borderColor: 'var(--color-border)' }}>
              <p className="font-medium" style={{ color: 'var(--color-text)' }}>
                {s.name}
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-success)' }}>
                {s.status}
              </p>
              <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
                사용량: {s.usage}
              </p>
            </div>
          ))}
        </div>
      </TenantPageTemplate>
    </AppShell>
  );
}
