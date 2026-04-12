// SLO Gauge — SLO 에러 버짓 게이지 — MTU-N557
// Design Ref: MTU-N255 sre-error-budget
// Plan SC: FR-UP.AI.7

'use client';

import { useEffect, useState } from 'react';

interface SLOData {
  serviceName: string;
  sloName: string;
  targetPercent: number;
  currentPercent: number;
  errorBudgetRemainingPercent: number;
  burnRate: number;
  windowDays: number;
}

interface SLOGaugeProps {
  serviceName: string;
  sloName: string;
  refreshMs?: number;
}

export function SLOGauge({ serviceName, sloName, refreshMs = 30000 }: SLOGaugeProps) {
  const [data, setData] = useState<SLOData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? '';
        const res = await fetch(`${apiBase}/api/slo?service=${serviceName}&slo=${sloName}`);
        if (!res.ok) return;
        const json = (await res.json()) as { data: SLOData };
        if (!cancelled) setData(json.data);
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
  }, [serviceName, sloName, refreshMs]);

  if (loading) {
    return (
      <div className="p-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        SLO 로딩 중...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 text-xs" style={{ color: 'var(--color-error)' }}>
        SLO 조회 실패
      </div>
    );
  }

  const budgetColor =
    data.errorBudgetRemainingPercent > 50
      ? 'var(--color-success)'
      : data.errorBudgetRemainingPercent > 20
        ? 'var(--color-warning)'
        : 'var(--color-error)';

  const burnColor = data.burnRate > 2 ? 'var(--color-error)' : data.burnRate > 1 ? 'var(--color-warning)' : 'var(--color-success)';

  return (
    <div
      className="p-4 border rounded-lg"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
      role="region"
      aria-label={`SLO 게이지 ${data.serviceName} ${data.sloName}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            {data.serviceName}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {data.sloName} · {data.windowDays}일 윈도우
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            목표
          </p>
          <p className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            {data.targetPercent.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span style={{ color: 'var(--color-text-muted)' }}>현재 가용성</span>
          <span style={{ color: 'var(--color-text)' }}>{data.currentPercent.toFixed(3)}%</span>
        </div>
        <div className="h-2 rounded overflow-hidden" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
          <div
            className="h-full"
            style={{
              width: `${Math.min(100, data.currentPercent)}%`,
              backgroundColor: data.currentPercent >= data.targetPercent ? 'var(--color-success)' : 'var(--color-error)',
            }}
          />
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs mb-1">
          <span style={{ color: 'var(--color-text-muted)' }}>에러 버짓 잔여</span>
          <span style={{ color: budgetColor }}>{data.errorBudgetRemainingPercent.toFixed(1)}%</span>
        </div>
        <div className="h-2 rounded overflow-hidden" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
          <div
            className="h-full"
            style={{ width: `${Math.max(0, data.errorBudgetRemainingPercent)}%`, backgroundColor: budgetColor }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
          소진율 (burn rate)
        </span>
        <span className="text-sm font-semibold" style={{ color: burnColor }}>
          {data.burnRate.toFixed(2)}x
        </span>
      </div>
    </div>
  );
}
