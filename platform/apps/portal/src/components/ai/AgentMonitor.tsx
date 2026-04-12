// Agent Monitor — AI 에이전트 실행 현황 테이블 — MTU-N554
// Design Ref: SVC-AI-ADV-R2 DESIGN §5
// Plan SC: FR-UP.AI.4

'use client';

import { useEffect, useState } from 'react';

interface AgentExecution {
  executionId: string;
  agentId: string;
  agentName: string;
  mode: 'react' | 'plan-execute' | 'orchestrate';
  status: 'running' | 'completed' | 'failed' | 'timeout';
  startedAt: number;
  durationMs?: number;
  iterations?: number;
  tokensUsed?: number;
}

interface AgentMonitorProps {
  tenantId: string;
  refreshMs?: number;
}

const STATUS_COLOR: Record<AgentExecution['status'], string> = {
  running: 'var(--color-info)',
  completed: 'var(--color-success)',
  failed: 'var(--color-error)',
  timeout: 'var(--color-warning)',
};

const STATUS_LABEL: Record<AgentExecution['status'], string> = {
  running: '실행중',
  completed: '완료',
  failed: '실패',
  timeout: '시간초과',
};

export function AgentMonitor({ tenantId, refreshMs = 5000 }: AgentMonitorProps) {
  const [executions, setExecutions] = useState<AgentExecution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? '';
        const res = await fetch(`${apiBase}/api/ai/agents/executions?tenantId=${tenantId}&limit=20`);
        if (!res.ok) return;
        const json = (await res.json()) as { data: { items: AgentExecution[] } };
        if (!cancelled) setExecutions(json.data.items);
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
  }, [tenantId, refreshMs]);

  return (
    <div
      className="border rounded-lg overflow-hidden"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
      role="region"
      aria-label="에이전트 실행 모니터"
    >
      <div
        className="px-3 py-2 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          에이전트 실행 현황
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                에이전트
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                모드
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                상태
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                반복
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                토큰
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>
                소요시간
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  로딩 중...
                </td>
              </tr>
            )}
            {!loading && executions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  실행 기록이 없습니다.
                </td>
              </tr>
            )}
            {executions.map((e) => (
              <tr key={e.executionId} className="border-t" style={{ borderColor: 'var(--color-border)' }}>
                <td className="px-3 py-2" style={{ color: 'var(--color-text)' }}>
                  {e.agentName}
                </td>
                <td className="px-3 py-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {e.mode}
                </td>
                <td className="px-3 py-2">
                  <span
                    className="inline-block px-2 py-0.5 text-xs rounded"
                    style={{ backgroundColor: STATUS_COLOR[e.status], color: '#fff' }}
                  >
                    {STATUS_LABEL[e.status]}
                  </span>
                </td>
                <td className="px-3 py-2 text-right text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {e.iterations ?? '-'}
                </td>
                <td className="px-3 py-2 text-right text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {e.tokensUsed ? e.tokensUsed.toLocaleString('ko-KR') : '-'}
                </td>
                <td className="px-3 py-2 text-right text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {e.durationMs ? `${(e.durationMs / 1000).toFixed(1)}s` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
