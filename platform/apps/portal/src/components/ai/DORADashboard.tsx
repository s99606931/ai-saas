// DORA Dashboard — DORA 4 Keys 실시간 게이지 — MTU-N552
// Design Ref: MTU-N251 dora-four-keys
// Plan SC: FR-UP.AI.2

'use client';

import { useEffect, useState } from 'react';

interface DORAMetrics {
  deploymentFrequency: { perDay: number; tier: 'elite' | 'high' | 'medium' | 'low' };
  leadTimeForChanges: { hours: number; tier: 'elite' | 'high' | 'medium' | 'low' };
  changeFailureRate: { percent: number; tier: 'elite' | 'high' | 'medium' | 'low' };
  meanTimeToRestore: { minutes: number; tier: 'elite' | 'high' | 'medium' | 'low' };
}

interface DORADashboardProps {
  tenantId: string;
  refreshIntervalMs?: number;
}

const TIER_COLORS = {
  elite: 'var(--color-success)',
  high: 'var(--color-info)',
  medium: 'var(--color-warning)',
  low: 'var(--color-error)',
} as const;

const TIER_LABELS = { elite: 'Elite', high: 'High', medium: 'Medium', low: 'Low' } as const;

export function DORADashboard({ tenantId, refreshIntervalMs = 30000 }: DORADashboardProps) {
  const [metrics, setMetrics] = useState<DORAMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchMetrics() {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? '';
        const res = await fetch(`${apiBase}/api/dora/metrics?tenantId=${tenantId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { data: DORAMetrics };
        if (!cancelled) {
          setMetrics(json.data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchMetrics();
    const id = setInterval(fetchMetrics, refreshIntervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [tenantId, refreshIntervalMs]);

  if (loading) {
    return (
      <div className="p-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        DORA 메트릭 로딩 중...
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-4 text-sm" style={{ color: 'var(--color-error)' }}>
        DORA 메트릭 조회 실패: {error ?? '데이터 없음'}
      </div>
    );
  }

  const cards = [
    {
      label: '배포 빈도',
      value: `${metrics.deploymentFrequency.perDay.toFixed(1)}/일`,
      tier: metrics.deploymentFrequency.tier,
    },
    {
      label: '변경 리드타임',
      value: `${metrics.leadTimeForChanges.hours.toFixed(1)}h`,
      tier: metrics.leadTimeForChanges.tier,
    },
    {
      label: '변경 실패율',
      value: `${metrics.changeFailureRate.percent.toFixed(1)}%`,
      tier: metrics.changeFailureRate.tier,
    },
    {
      label: '평균 복구 시간',
      value: `${metrics.meanTimeToRestore.minutes.toFixed(0)}분`,
      tier: metrics.meanTimeToRestore.tier,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" role="region" aria-label="DORA 4 Keys 대시보드">
      {cards.map((card) => (
        <div
          key={card.label}
          className="p-4 border rounded-lg"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
        >
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {card.label}
          </p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>
            {card.value}
          </p>
          <span
            className="inline-block mt-2 px-2 py-0.5 text-xs rounded"
            style={{ backgroundColor: TIER_COLORS[card.tier], color: '#fff' }}
          >
            {TIER_LABELS[card.tier]}
          </span>
        </div>
      ))}
    </div>
  );
}
