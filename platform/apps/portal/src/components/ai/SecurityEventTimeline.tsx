// Security Event Timeline — 보안 이벤트 타임라인 — MTU-N556
// Design Ref: SVC-AI-SECURITY DESIGN §1
// Plan SC: FR-UP.AI.6
// CSAP: D-06 침해사고 관리

'use client';

import { useEffect, useState } from 'react';

interface SecurityEvent {
  id: string;
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: 'auth_failure' | 'anomaly' | 'dlp_block' | 'threat_detected' | 'policy_violation';
  source: string;
  message: string;
  actor?: string;
}

interface SecurityEventTimelineProps {
  tenantId: string;
  limit?: number;
  refreshMs?: number;
}

const SEVERITY_COLOR: Record<SecurityEvent['severity'], string> = {
  low: 'var(--color-info)',
  medium: 'var(--color-warning)',
  high: 'var(--color-error)',
  critical: '#7f1d1d',
};

const TYPE_LABEL: Record<SecurityEvent['type'], string> = {
  auth_failure: '인증 실패',
  anomaly: '이상 탐지',
  dlp_block: 'DLP 차단',
  threat_detected: '위협 탐지',
  policy_violation: '정책 위반',
};

export function SecurityEventTimeline({ tenantId, limit = 30, refreshMs = 10000 }: SecurityEventTimelineProps) {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [filterSeverity, setFilterSeverity] = useState<SecurityEvent['severity'] | 'all'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? '';
        const res = await fetch(`${apiBase}/api/security/events?tenantId=${tenantId}&limit=${limit}`);
        if (!res.ok) return;
        const json = (await res.json()) as { data: { items: SecurityEvent[] } };
        if (!cancelled) setEvents(json.data.items);
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
  }, [tenantId, limit, refreshMs]);

  const visible = filterSeverity === 'all' ? events : events.filter((e) => e.severity === filterSeverity);

  return (
    <div
      className="border rounded-lg overflow-hidden"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
      role="region"
      aria-label="보안 이벤트 타임라인"
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          보안 이벤트
        </span>
        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value as SecurityEvent['severity'] | 'all')}
          className="text-xs px-2 py-1 border rounded"
          style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
        >
          <option value="all">전체</option>
          <option value="critical">긴급</option>
          <option value="high">높음</option>
          <option value="medium">중간</option>
          <option value="low">낮음</option>
        </select>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading && (
          <p className="p-4 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
            로딩 중...
          </p>
        )}
        {!loading && visible.length === 0 && (
          <p className="p-4 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
            이벤트가 없습니다.
          </p>
        )}
        <ol className="relative">
          {visible.map((e) => (
            <li
              key={e.id}
              className="relative pl-8 pr-3 py-3 border-b"
              style={{ borderColor: 'var(--color-border)' }}
            >
              <span
                className="absolute left-3 top-4 w-3 h-3 rounded-full"
                style={{ backgroundColor: SEVERITY_COLOR[e.severity] }}
                aria-hidden="true"
              />
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                    {TYPE_LABEL[e.type]} · {e.source}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                    {e.message}
                  </p>
                  {e.actor && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      행위자: {e.actor}
                    </p>
                  )}
                </div>
                <span className="text-xs whitespace-nowrap" style={{ color: 'var(--color-text-muted)' }}>
                  {new Date(e.timestamp).toLocaleString('ko-KR')}
                </span>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
