// Tenant Health Grid — 테넌트 건강 스코어 그리드 — MTU-N558
// Design Ref: SVC-HEALTHAGG-R23
// Plan SC: FR-UP.AI.8

'use client';

import { useEffect, useState } from 'react';

interface TenantHealth {
  tenantId: string;
  tenantName: string;
  healthScore: number;
  status: 'healthy' | 'degraded' | 'critical';
  components: {
    api: number;
    db: number;
    cache: number;
    queue: number;
  };
  lastChecked: number;
}

interface TenantHealthGridProps {
  refreshMs?: number;
}

const STATUS_COLOR: Record<TenantHealth['status'], string> = {
  healthy: 'var(--color-success)',
  degraded: 'var(--color-warning)',
  critical: 'var(--color-error)',
};

const STATUS_LABEL: Record<TenantHealth['status'], string> = {
  healthy: '정상',
  degraded: '저하',
  critical: '위험',
};

function scoreColor(score: number): string {
  if (score >= 90) return 'var(--color-success)';
  if (score >= 70) return 'var(--color-warning)';
  return 'var(--color-error)';
}

export function TenantHealthGrid({ refreshMs = 15000 }: TenantHealthGridProps) {
  const [tenants, setTenants] = useState<TenantHealth[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? '';
        const res = await fetch(`${apiBase}/api/health/tenants`);
        if (!res.ok) return;
        const json = (await res.json()) as { data: { items: TenantHealth[] } };
        if (!cancelled) setTenants(json.data.items);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, refreshMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [refreshMs]);

  if (loading) {
    return (
      <div className="p-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        테넌트 상태 로딩 중...
      </div>
    );
  }

  return (
    <div className="space-y-3" role="region" aria-label="테넌트 건강 그리드">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          테넌트 건강 현황 ({tenants.length}개)
        </h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tenants.map((t) => (
          <div
            key={t.tenantId}
            className="p-3 border rounded-lg"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                  {t.tenantName}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {t.tenantId.slice(0, 8)}
                </p>
              </div>
              <span
                className="px-2 py-0.5 text-xs rounded"
                style={{ backgroundColor: STATUS_COLOR[t.status], color: '#fff' }}
              >
                {STATUS_LABEL[t.status]}
              </span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                건강 점수
              </span>
              <span className="text-lg font-bold" style={{ color: scoreColor(t.healthScore) }}>
                {t.healthScore}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1 text-center">
              {(['api', 'db', 'cache', 'queue'] as const).map((key) => (
                <div key={key}>
                  <p className="text-xs uppercase" style={{ color: 'var(--color-text-muted)' }}>
                    {key}
                  </p>
                  <p className="text-xs font-medium" style={{ color: scoreColor(t.components[key]) }}>
                    {t.components[key]}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
