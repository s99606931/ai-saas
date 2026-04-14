// Design Ref: SVC-AI-ADV-R679.design.md — AI기반 분산 추적 분석 v3
// Plan SC: FR-R679.1~5

export type SpanLevel = 'CRITICAL' | 'HIGH' | 'LOW';
export type SpanAction = 'IGNORE' | 'PROFILE' | 'OPTIMIZE';

interface Trace { traceId: string; rootService: string; totalMs: number }
interface Span {
  spanId: string;
  traceId: string;
  serviceName: string;
  durationMs: number;
  hasError: boolean;
}
interface SpanAdvice {
  spanId: string;
  traceId: string;
  level: SpanLevel;
  action: SpanAction;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

const ACTION_RANK: SpanAction[] = ['IGNORE', 'PROFILE', 'OPTIMIZE'];

function rankToAction(rank: number): SpanAction {
  const idx = Math.max(0, Math.min(ACTION_RANK.length - 1, rank));
  return ACTION_RANK[idx]!;
}

export class DistributedTracingAIV3 {
  private traces = new Map<string, Trace>();
  private advices: SpanAdvice[] = [];
  private auditLog: AuditEntry[] = [];

  registerTrace(trace: Trace): void {
    if (trace.totalMs <= 0) {
      throw new Error('INVALID_TOTAL_MS');
    }
    this.traces.set(trace.traceId, trace);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'REGISTER_TRACE',
      details: { traceId: trace.traceId, rootService: trace.rootService, totalMs: trace.totalMs },
    });
  }

  analyzeSpan(span: Span, dataGrade?: string): SpanAdvice {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    const trace = this.traces.get(span.traceId);
    if (!trace) {
      throw new Error(`UNKNOWN_TRACE: ${span.traceId}`);
    }
    if (span.durationMs < 0) {
      throw new Error('INVALID_DURATION');
    }

    const ratio = span.durationMs / trace.totalMs;
    let level: SpanLevel;
    let baseRank: number;
    if (ratio >= 0.5) {
      level = 'CRITICAL';
      baseRank = 2;
    } else if (ratio >= 0.25) {
      level = 'HIGH';
      baseRank = 1;
    } else {
      level = 'LOW';
      baseRank = 0;
    }

    const finalRank = span.hasError ? baseRank + 1 : baseRank;
    const action = rankToAction(finalRank);

    const advice: SpanAdvice = { spanId: span.spanId, traceId: span.traceId, level, action };
    this.advices.push(advice);
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'ANALYZE_SPAN',
      details: {
        spanId: span.spanId,
        traceId: span.traceId,
        serviceName: span.serviceName,
        level,
        action,
      },
    });
    return advice;
  }

  getOptimizeTargets(): SpanAdvice[] {
    return this.advices.filter((a) => a.action === 'OPTIMIZE');
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
