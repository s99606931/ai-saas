// Design Ref: DESIGN-MTU-P16b — 알림 관리
import { AppShell } from '@/components/layout/AppShell';
import { AdminPageTemplate } from '@/components/admin/AdminPageTemplate';

export default function AdminNotificationsPage() {
  return (
    <AppShell>
      <AdminPageTemplate title="알림 관리" description="시스템 알림 및 채널 설정">
        <div className="border rounded-lg p-4" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            이메일, 웹훅, 인앱 알림 채널 구성
          </p>
        </div>
      </AdminPageTemplate>
    </AppShell>
  );
}
