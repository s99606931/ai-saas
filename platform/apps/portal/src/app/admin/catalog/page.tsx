// Design Ref: DESIGN-MTU-P16a — 서비스 카탈로그
import { AppShell } from '@/components/layout/AppShell';
import { AdminPageTemplate } from '@/components/admin/AdminPageTemplate';
import { ServiceCatalogGrid } from '@/components/admin/ServiceCatalogGrid';

export default function CatalogPage() {
  return (
    <AppShell>
      <AdminPageTemplate title="서비스 카탈로그" description="SaaS 서비스를 관리합니다.">
        <ServiceCatalogGrid />
      </AdminPageTemplate>
    </AppShell>
  );
}
