// Citizen Request Dashboard — 민원 처리 현황 — MTU-N555
// Design Ref: SVC-AI-PUBLIC DESIGN §1
// Plan SC: FR-UP.AI.5

'use client';

import { useEffect, useState } from 'react';

interface CitizenRequestStats {
  total: number;
  pending: number;
  inProgress: number;
  completed: number;
  avgResponseTimeHours: number;
  satisfactionScore: number;
  byCategory: Array<{ category: string; count: number }>;
}

interface CitizenRequestDashboardProps {
  tenantId: string;
  period?: '7d' | '30d' | '90d';
}

export function CitizenRequestDashboard({ tenantId, period = '30d' }: CitizenRequestDashboardProps) {
  const [stats, setStats] = useState<CitizenRequestStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPeriod, setCurrentPeriod] = useState(period);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? '';
        const res = await fetch(`${apiBase}/api/civic/requests/stats?tenantId=${tenantId}&period=${currentPeriod}`);
        if (!res.ok) return;
        const json = (await res.json()) as { data: CitizenRequestStats };
        setStats(json.data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [tenantId, currentPeriod]);

  if (loading) {
    return (
      <div className="p-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        민원 통계 로딩 중...
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-4 text-sm" style={{ color: 'var(--color-error)' }}>
        민원 통계를 불러올 수 없습니다.
      </div>
    );
  }

  const cards = [
    { label: '전체 민원', value: stats.total.toLocaleString('ko-KR'), color: 'var(--color-primary)' },
    { label: '대기 중', value: stats.pending.toLocaleString('ko-KR'), color: 'var(--color-warning)' },
    { label: '처리 중', value: stats.inProgress.toLocaleString('ko-KR'), color: 'var(--color-info)' },
    { label: '완료', value: stats.completed.toLocaleString('ko-KR'), color: 'var(--color-success)' },
  ];

  const maxCategoryCount = Math.max(...stats.byCategory.map((c) => c.count), 1);

  return (
    <div className="space-y-4" role="region" aria-label="민원 처리 대시보드">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold" style={{ color: 'var(--color-text)' }}>
          민원 처리 현황
        </h3>
        <select
          value={currentPeriod}
          onChange={(e) => setCurrentPeriod(e.target.value as '7d' | '30d' | '90d')}
          className="text-xs px-2 py-1 border rounded"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
        >
          <option value="7d">최근 7일</option>
          <option value="30d">최근 30일</option>
          <option value="90d">최근 90일</option>
        </select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div
            key={c.label}
            className="p-3 border rounded-lg"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
          >
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {c.label}
            </p>
            <p className="text-2xl font-bold mt-1" style={{ color: c.color }}>
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div
          className="p-4 border rounded-lg"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
        >
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            평균 응답 시간
          </p>
          <p className="text-xl font-semibold mt-1" style={{ color: 'var(--color-text)' }}>
            {stats.avgResponseTimeHours.toFixed(1)} 시간
          </p>
        </div>
        <div
          className="p-4 border rounded-lg"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
        >
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            만족도 점수
          </p>
          <p className="text-xl font-semibold mt-1" style={{ color: 'var(--color-text)' }}>
            {stats.satisfactionScore.toFixed(2)} / 5.0
          </p>
        </div>
      </div>

      <div
        className="p-4 border rounded-lg"
        style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
      >
        <p className="text-sm font-medium mb-3" style={{ color: 'var(--color-text)' }}>
          카테고리별 분포
        </p>
        <div className="space-y-2">
          {stats.byCategory.map((c) => (
            <div key={c.category}>
              <div className="flex justify-between text-xs mb-1">
                <span style={{ color: 'var(--color-text)' }}>{c.category}</span>
                <span style={{ color: 'var(--color-text-muted)' }}>{c.count.toLocaleString('ko-KR')}</span>
              </div>
              <div
                className="h-2 rounded overflow-hidden"
                style={{ backgroundColor: 'var(--color-bg-secondary)' }}
              >
                <div
                  className="h-full"
                  style={{
                    width: `${(c.count / maxCategoryCount) * 100}%`,
                    backgroundColor: 'var(--color-primary)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
