// SVC-AI-ADV-R363 Public API Gateway AI v2
// Design Ref: SVC-AI-ADV-R363.design.md
// Plan SC: SC-R363-1~4
// CSAP D-08 / N2SF N-05

export type DataGrade = 'O' | 'C' | 'S';

export interface ApiRequest {
  readonly clientId: string;
  readonly path: string;
  readonly payload: string;
  readonly timestamp: number;
}

export interface TrafficAnalysis {
  readonly rate: number;
  readonly spike: boolean;
  readonly malicious: boolean;
  readonly block: boolean;
  readonly reasons: readonly string[];
}

export interface AuditEntry {
  readonly timestamp: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const MALICIOUS_PATTERNS = [
  'union select',
  '<script',
  'drop table',
  '../../',
  'eval(',
  'onerror=',
];

export class PublicApiGatewayAiV2 {
  private readonly auditLog: AuditEntry[] = [];

  analyze(
    requests: readonly ApiRequest[],
    windowSec: number,
    rateThreshold: number,
    grade: DataGrade = 'O',
  ): TrafficAnalysis {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`N2SF_BLOCKED: ${grade}등급 트래픽 차단 (N2SF N-05)`);
    }
    if (windowSec <= 0 || rateThreshold <= 0) {
      throw new Error('INVALID_PARAMS: window/threshold must be positive');
    }

    const reasons: string[] = [];
    const rate = requests.length / windowSec;
    const spike = rate > rateThreshold;
    if (spike) reasons.push('RATE_SPIKE');

    let malicious = false;
    for (const r of requests) {
      const lower = r.payload.toLowerCase();
      for (const pat of MALICIOUS_PATTERNS) {
        if (lower.includes(pat)) {
          malicious = true;
          reasons.push(`PATTERN:${pat}`);
          break;
        }
      }
      if (malicious) break;
    }

    const block = spike || malicious;

    const result: TrafficAnalysis = {
      rate: Number(rate.toFixed(4)),
      spike,
      malicious,
      block,
      reasons,
    };

    this.record('ANALYZE', 'traffic', { rate: result.rate, block });

    return result;
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.auditLog;
  }

  private record(action: string, target: string, details: Record<string, unknown>): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      target,
      details,
    });
  }
}
