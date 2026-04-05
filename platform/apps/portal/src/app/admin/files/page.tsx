// Design Ref: DESIGN-MTU-P16b — 파일 관리
import { AppShell } from '@/components/layout/AppShell';
import { AdminPageTemplate } from '@/components/admin/AdminPageTemplate';

export default function AdminFilesPage() {
  return (
    <AppShell>
      <AdminPageTemplate title="파일 관리" description="파일 저장소 현황 및 정책 관리">
        <div className="border rounded-lg p-4" style={{ borderColor: 'var(--color-border)' }}>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            AES-256 암호화, 테넌트별 격리 저장소
          </p>
        </div>
      </AdminPageTemplate>
    </AppShell>
  );
}
