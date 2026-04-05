// Design Ref: DESIGN-MTU-P16a — 관리자 대시보드
import { AppShell } from '@/components/layout/AppShell';
import { DashboardContent } from '@/components/admin/DashboardContent';

export default function AdminDashboardPage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}
