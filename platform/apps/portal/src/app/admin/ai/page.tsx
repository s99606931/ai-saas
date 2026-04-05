// Design Ref: DESIGN-MTU-P16b — AI 서비스 관리
import { AppShell } from '@/components/layout/AppShell';
import { AdminPageTemplate } from '@/components/admin/AdminPageTemplate';

export default function AdminAiPage() {
  return (
    <AppShell>
      <AdminPageTemplate title="AI 서비스 관리" description="AI 모델 구성 및 사용량 모니터링">
        <div className="space-y-4">
          <div className="border rounded-lg p-4" style={{ borderColor: 'var(--color-border)' }}>
            <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>활성 모델</h3>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>LM Studio (로컬) — N2SF O등급 데이터만 전송</p>
          </div>
          <div className="border rounded-lg p-4" style={{ borderColor: 'var(--color-border)' }}>
            <h3 className="font-semibold mb-2" style={{ color: 'var(--color-text)' }}>일일 사용량</h3>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>요청: 1,245건 | 토큰: 2.3M</p>
          </div>
        </div>
      </AdminPageTemplate>
    </AppShell>
  );
}
