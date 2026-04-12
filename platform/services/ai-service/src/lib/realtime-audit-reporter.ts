// Design Ref: §R178 AI기반실시간감사보고서생성
// Plan SC: FR-R178.1~5

export type AuditCategory = 'ACCESS' | 'DATA_CHANGE' | 'AUTH' | 'ADMIN' | 'AI_OPERATION';

export interface AuditEvent {
  id: string;
  category: AuditCategory;
  actor: string;
  tenantId: string;
  action: string;
  resource: string;
  outcome: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface AuditSummary {
  period: { from: string; to: string };
  tenantId: string;
  totalEvents: number;
  byCategory: Record<AuditCategory, number>;
  byOutcome: Record<'SUCCESS' | 'FAILURE' | 'BLOCKED', number>;
  topActors: Array<{ actor: string; count: number }>;
  anomalies: string[];
  generatedAt: string;
}

export interface ComplianceCheck {
  rule: string;
  passed: boolean;
  evidence?: string;
}

export interface AuditReport {
  reportId: string;
  tenantId: string;
  summary: AuditSummary;
  complianceChecks: ComplianceCheck[];
  riskScore: number; // 0~100
  generatedAt: string;
}

export class RealtimeAuditReporter {
  private events: AuditEvent[] = [];
  private reportCounter = 1;

  // FR-R178.1 이벤트 기록 (append-only — CSAP D-06)
  record(event: AuditEvent): void {
    this.events.push({ ...event });
  }

  // FR-R178.2 기간별 이벤트 조회
  query(tenantId: string, from: string, to: string): AuditEvent[] {
    const fromMs = new Date(from).getTime();
    const toMs = new Date(to).getTime();
    return this.events.filter(
      (e) =>
        e.tenantId === tenantId &&
        new Date(e.timestamp).getTime() >= fromMs &&
        new Date(e.timestamp).getTime() <= toMs
    );
  }

  // FR-R178.3 실시간 요약 생성
  summarize(tenantId: string, from: string, to: string): AuditSummary {
    const relevant = this.query(tenantId, from, to);

    const byCategory: Record<AuditCategory, number> = {
      ACCESS: 0, DATA_CHANGE: 0, AUTH: 0, ADMIN: 0, AI_OPERATION: 0,
    };
    const byOutcome: Record<'SUCCESS' | 'FAILURE' | 'BLOCKED', number> = {
      SUCCESS: 0, FAILURE: 0, BLOCKED: 0,
    };
    const actorCount = new Map<string, number>();

    for (const e of relevant) {
      byCategory[e.category]++;
      byOutcome[e.outcome]++;
      actorCount.set(e.actor, (actorCount.get(e.actor) ?? 0) + 1);
    }

    const topActors = Array.from(actorCount.entries())
      .map(([actor, count]) => ({ actor, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const anomalies: string[] = [];
    if (byOutcome.BLOCKED > relevant.length * 0.1) {
      anomalies.push(`차단 이벤트 비율 높음: ${byOutcome.BLOCKED}건`);
    }
    if (byOutcome.FAILURE > relevant.length * 0.2) {
      anomalies.push(`실패 이벤트 비율 높음: ${byOutcome.FAILURE}건`);
    }

    return {
      period: { from, to },
      tenantId,
      totalEvents: relevant.length,
      byCategory,
      byOutcome,
      topActors,
      anomalies,
      generatedAt: new Date().toISOString(),
    };
  }

  // FR-R178.4 CSAP 준수 검사
  checkCompliance(tenantId: string, from: string, to: string): ComplianceCheck[] {
    const events = this.query(tenantId, from, to);
    return [
      {
        rule: 'CSAP D-06: 감사 로그 보존',
        passed: events.length > 0,
        evidence: `${events.length}건 로그 확인`,
      },
      {
        rule: 'CSAP D-08: 접근 통제 (인증 실패 5회 이상 시 경보)',
        passed: events.filter((e) => e.category === 'AUTH' && e.outcome === 'FAILURE').length < 5,
        evidence: `인증 실패 ${events.filter((e) => e.category === 'AUTH' && e.outcome === 'FAILURE').length}건`,
      },
      {
        rule: 'N2SF N-05: AI 작업 감사 추적',
        passed: events.filter((e) => e.category === 'AI_OPERATION').length > 0 || events.length === 0,
        evidence: `AI 작업 ${events.filter((e) => e.category === 'AI_OPERATION').length}건 기록`,
      },
    ];
  }

  // FR-R178.5 전체 감사 보고서 생성
  generateReport(tenantId: string, from: string, to: string): AuditReport {
    const summary = this.summarize(tenantId, from, to);
    const complianceChecks = this.checkCompliance(tenantId, from, to);

    const failedChecks = complianceChecks.filter((c) => !c.passed).length;
    const riskScore = Math.min(100,
      failedChecks * 30 +
      (summary.byOutcome.BLOCKED > 10 ? 20 : 0) +
      (summary.anomalies.length * 10)
    );

    return {
      reportId: `RPT-${this.reportCounter++}`,
      tenantId,
      summary,
      complianceChecks,
      riskScore,
      generatedAt: new Date().toISOString(),
    };
  }

  // 전체 이벤트 수 (불변 감사 추적 확인용)
  totalEventCount(): number {
    return this.events.length;
  }
}
