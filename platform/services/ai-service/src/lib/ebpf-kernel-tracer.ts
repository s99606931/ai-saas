// Design Ref: MTU-N431 §eBPF 커널 추적
// Plan SC: FR-N431.1~5

export type SyscallName = 'read' | 'write' | 'connect' | 'accept' | 'open' | 'exec';

export interface SyscallEvent {
  timestamp: number;
  pid: number;
  syscall: SyscallName;
  args: Record<string, string | number>;
  returnCode: number;
  latencyNs: number;
}

export interface ProcessMapping {
  pid: number;
  containerId: string;
  serviceName: string;
  namespace: string;
}

export interface MappedEvent extends SyscallEvent {
  service: string;
  container: string;
}

export interface AnomalyFlag {
  eventIndex: number;
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

export interface OtelSpan {
  traceId: string;
  spanId: string;
  name: string;
  startTime: number;
  durationNs: number;
  attributes: Record<string, string | number>;
}

export interface AuditEntry {
  actor: string;
  action: string;
  target: string;
  timestamp: string;
  severity: string;
}

export class EbpfKernelTracer {
  /** FR-N431.1 시스템콜 이벤트 수집 */
  ingestEvents(events: SyscallEvent[]): SyscallEvent[] {
    return events.filter((e) => e.timestamp > 0 && e.pid > 0);
  }

  /** FR-N431.2 PID → 서비스 매핑 */
  mapToServices(events: SyscallEvent[], mappings: ProcessMapping[]): MappedEvent[] {
    const pidMap = new Map(mappings.map((m) => [m.pid, m]));
    const mapped: MappedEvent[] = [];
    for (const e of events) {
      const m = pidMap.get(e.pid);
      if (!m) continue;
      mapped.push({ ...e, service: m.serviceName, container: m.containerId });
    }
    return mapped;
  }

  /** FR-N431.3 이상 패턴 탐지 */
  detectAnomalies(events: MappedEvent[]): AnomalyFlag[] {
    const flags: AnomalyFlag[] = [];
    events.forEach((e, idx) => {
      // 비정상 경로 접근
      const path = String(e.args['path'] ?? '');
      if (path.startsWith('/etc/shadow') || path.includes('/proc/self/mem')) {
        flags.push({ eventIndex: idx, reason: `민감 경로 접근: ${path}`, severity: 'high' });
      }
      // 권한 상승 시도
      if (e.syscall === 'exec' && (path.includes('sudo') || path.includes('setuid'))) {
        flags.push({ eventIndex: idx, reason: '권한 상승 시도', severity: 'high' });
      }
      // 비정상적으로 긴 시스템콜
      if (e.latencyNs > 1_000_000_000) {
        flags.push({ eventIndex: idx, reason: '시스템콜 1초 이상 지연', severity: 'medium' });
      }
    });
    return flags;
  }

  /** FR-N431.4 OTel Span 변환 */
  toOtelSpans(events: MappedEvent[], traceId: string): OtelSpan[] {
    return events.map((e, idx) => ({
      traceId,
      spanId: `span-${idx}-${e.pid}`,
      name: `syscall.${e.syscall}`,
      startTime: e.timestamp,
      durationNs: e.latencyNs,
      attributes: {
        'service.name': e.service,
        'container.id': e.container,
        'syscall.return_code': e.returnCode,
      },
    }));
  }

  /** FR-N431.5 감사 로그 변환 */
  toAuditEntries(events: MappedEvent[], flags: AnomalyFlag[]): AuditEntry[] {
    const entries: AuditEntry[] = [];
    for (const f of flags) {
      const e = events[f.eventIndex];
      if (!e) continue;
      entries.push({
        actor: `pid:${e.pid}`,
        action: `SYSCALL_${e.syscall.toUpperCase()}`,
        target: e.service,
        timestamp: new Date(e.timestamp).toISOString(),
        severity: f.severity,
      });
    }
    return entries;
  }
}

export const ebpfKernelTracer = new EbpfKernelTracer();
