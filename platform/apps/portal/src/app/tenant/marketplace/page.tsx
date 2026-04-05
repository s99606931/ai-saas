// Design Ref: DESIGN-MTU-P17 — 서비스 마켓플레이스
import { AppShell } from '@/components/layout/AppShell';
import { TenantPageTemplate } from '@/components/tenant/TenantPageTemplate';
import { ServiceMarketplace } from '@/components/tenant/ServiceMarketplace';

export default function MarketplacePage() {
  return (
    <AppShell>
      <TenantPageTemplate title="서비스 마켓플레이스" description="공공 SaaS 서비스를 구독하세요.">
        <ServiceMarketplace />
      </TenantPageTemplate>
    </AppShell>
  );
}
