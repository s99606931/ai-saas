// Design Ref: DESIGN-MTU-U1-P — 메인 엔트리 포인트
// 인증 상태에 따라 관리자/테넌트 포털로 라우팅

import { AppShell } from '@/components/layout/AppShell';
import { DashboardContent } from '@/components/admin/DashboardContent';

export default function HomePage() {
  return (
    <AppShell>
      <DashboardContent />
    </AppShell>
  );
}
