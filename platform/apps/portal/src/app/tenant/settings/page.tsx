// Design Ref: DESIGN-MTU-P17 — 테넌트 설정
import { AppShell } from '@/components/layout/AppShell';
import { TenantPageTemplate } from '@/components/tenant/TenantPageTemplate';

export default function TenantSettingsPage() {
  return (
    <AppShell>
      <TenantPageTemplate title="테넌트 설정" description="조직 정보 및 보안 설정">
        <div className="space-y-4">
          <div className="border rounded-lg p-4" style={{ borderColor: 'var(--color-border)' }}>
            <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>조직 정보</h3>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>조직명, 도메인, 관리자 설정</p>
          </div>
          <div className="border rounded-lg p-4" style={{ borderColor: 'var(--color-border)' }}>
            <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>보안 설정</h3>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>MFA 정책, 세션 타임아웃, IP 허용목록</p>
          </div>
        </div>
      </TenantPageTemplate>
    </AppShell>
  );
}
