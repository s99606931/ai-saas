// Design Ref: docs/02-design/mtus/SVC-AI-ADV-R82.design.md
// Plan SC: FR-R82.1~5 (SVC-AI-ADV-R82 Constitutional AI 자기 교정)
// CSAP: D-06 감사, D-12 개발 보안 / ISMS-P 행정 중립
//
// 명시된 헌법 원칙(Constitution) 목록으로 AI 응답을 비평하고 수정 루프를 실행한다.
// 일반 Reflexion(self-correction-loop.ts, R53)과 달리, 공공기관 윤리 원칙에 특화된다.

export type PrincipleSeverity = 'low' | 'medium' | 'high';

export interface Principle {
  id: string;
  description: string;
  severity: PrincipleSeverity;
  /** 위반 시 이유 반환, 통과 시 null */
  check: (response: string) => string | null;
}

export interface ViolationReport {
  principleId: string;
  reason: string;
  severity: PrincipleSeverity;
}

export interface ReviseFn {
  (query: string, response: string, violations: ViolationReport[]): Promise<string>;
}

export interface ConstitutionalOptions {
  maxIter?: number;
  blockOnHighFailure?: boolean;
}

export interface ConstitutionalResult {
  finalResponse: string;
  iterations: number;
  converged: boolean;
  violations: ViolationReport[][];
  blocked: boolean;
}

export interface AuditEvent {
  ts: string;
  action: 'CREATE' | 'CRITIQUE' | 'REVISE' | 'CONVERGED' | 'FAILED' | 'BLOCKED';
  details: Record<string, unknown>;
}

const DEFAULT_MAX_ITER = 3;

export class ConstitutionalAiPipeline {
  private readonly principles = new Map<string, Principle>();
  private readonly revise: ReviseFn;
  private readonly auditLog: AuditEvent[] = [];

  constructor(revise: ReviseFn, principles: Principle[] = []) {
    this.revise = revise;
    for (const p of principles) this.register(p);
  }

  /** FR-R82.1: 원칙 등록 */
  register(p: Principle): void {
    if (!p.id || typeof p.check !== 'function') {
      throw new Error('invalid principle');
    }
    this.principles.set(p.id, p);
    this.log('CREATE', { id: p.id, severity: p.severity });
  }

  /** FR-R82.2~4: 비평 → 수정 루프 */
  async run(
    query: string,
    initialResponse: string,
    options: ConstitutionalOptions = {},
  ): Promise<ConstitutionalResult> {
    const maxIter = options.maxIter ?? DEFAULT_MAX_ITER;
    const blockOnHigh = options.blockOnHighFailure ?? true;

    let response = initialResponse;
    const history: ViolationReport[][] = [];

    for (let iter = 0; iter <= maxIter; iter++) {
      const violations = this.critique(response);
      history.push(violations);
      this.log('CRITIQUE', { iter, violationCount: violations.length });

      if (violations.length === 0) {
        this.log('CONVERGED', { iter });
        return {
          finalResponse: response,
          iterations: iter,
          converged: true,
          violations: history,
          blocked: false,
        };
      }

      if (iter >= maxIter) {
        // 수렴 실패
        const hasHigh = violations.some((v) => v.severity === 'high');
        if (hasHigh && blockOnHigh) {
          this.log('BLOCKED', { iter, reason: 'high_severity_unresolved' });
          return {
            finalResponse: '[정책 위반으로 응답이 제한되었습니다]',
            iterations: iter,
            converged: false,
            violations: history,
            blocked: true,
          };
        }
        this.log('FAILED', { iter, violationCount: violations.length });
        return {
          finalResponse: response,
          iterations: iter,
          converged: false,
          violations: history,
          blocked: false,
        };
      }

      // FR-R82.3: 수정 생성
      response = await this.revise(query, response, violations);
      this.log('REVISE', { iter, length: response.length });
    }

    // 이론상 도달 불가
    return {
      finalResponse: response,
      iterations: maxIter,
      converged: false,
      violations: history,
      blocked: false,
    };
  }

  /** 현재 응답을 모든 원칙으로 비평 (단순 동기 래퍼) */
  critique(response: string): ViolationReport[] {
    const out: ViolationReport[] = [];
    this.principles.forEach((p) => {
      const reason = p.check(response);
      if (reason !== null) {
        out.push({ principleId: p.id, reason, severity: p.severity });
      }
    });
    return out;
  }

  /** FR-R82.5 */
  getAuditLog(): readonly AuditEvent[] {
    return this.auditLog.slice();
  }

  private log(action: AuditEvent['action'], details: Record<string, unknown>): void {
    this.auditLog.push({ ts: new Date().toISOString(), action, details });
  }
}

/** 공공기관 기본 헌법 원칙 팩토리 */
export function defaultPublicPrinciples(): Principle[] {
  return [
    {
      id: 'P-PII',
      description: '주민등록번호 등 PII 노출 금지',
      severity: 'high',
      check: (r) => (/\b\d{6}-\d{7}\b/.test(r) ? 'PII(주민번호) 노출' : null),
    },
    {
      id: 'P-PHONE',
      description: '전화번호 노출 금지',
      severity: 'medium',
      check: (r) => (/\b01[016789]-?\d{3,4}-?\d{4}\b/.test(r) ? '전화번호 노출' : null),
    },
    {
      id: 'P-NEUTRAL',
      description: '정치적 중립 (특정 정당명 금지)',
      severity: 'high',
      check: (r) => {
        const parties = ['더불어민주당', '국민의힘'];
        const found = parties.find((p) => r.includes(p));
        return found ? `정당명 언급: ${found}` : null;
      },
    },
    {
      id: 'P-HARM',
      description: '폭력/차별 표현 금지',
      severity: 'high',
      check: (r) => {
        const harms = ['죽여', '폭력으로', '혐오'];
        const found = harms.find((h) => r.includes(h));
        return found ? `유해 표현: ${found}` : null;
      },
    },
    {
      id: 'P-SECRET',
      description: '시스템 내부 경로/시크릿 노출 금지',
      severity: 'medium',
      check: (r) => (/sk-[A-Za-z0-9]{20,}|\/var\/secrets\//.test(r) ? '시크릿/경로 노출' : null),
    },
  ];
}

export function createConstitutionalAiPipeline(
  revise: ReviseFn,
  principles?: Principle[],
): ConstitutionalAiPipeline {
  return new ConstitutionalAiPipeline(revise, principles ?? defaultPublicPrinciples());
}
