// Semantic Firewall — FR-R59.1~R59.6
// Design Ref: SVC-AI-ADV-R59 DESIGN §모듈 구조
// Plan SC: 인젝션 95% 차단, 오탐 < 2%
// CSAP: D-12 입력검증 / D-06 감사 / N2SF N-05

// ── 타입 ─────────────────────────────────────────────────────────────────────

export type FirewallDecision = 'allow' | 'block' | 'review';
export type DataGrade = 'C' | 'S' | 'O';

export interface FirewallPolicy {
  /** 소문자화된 인젝션 키워드 */
  blockPatterns: string[];
  /** 탈옥 의도 키워드 */
  jailbreakKeywords: string[];
  /** PII/시크릿 패턴 */
  piiPatterns: RegExp[];
  /** 임계값 */
  thresholds: { block: number; review: number };
}

export interface InspectContext {
  tenantId?: string;
  userId?: string;
  grade?: DataGrade;
}

export interface InspectResult {
  decision: FirewallDecision;
  score: number;
  reasons: string[];
  classification: { toxic: number; pii: number; secret: number };
  timestamp: string;
}

export interface FirewallAuditEntry {
  timestamp: string;
  action: 'INSPECT' | 'BLOCK' | 'REVIEW' | 'ALLOW' | 'POLICY_RELOAD' | 'GRADE_BLOCKED';
  score: number;
  reasons: string[];
  tenantId?: string;
  userId?: string;
}

// ── 기본 정책 ────────────────────────────────────────────────────────────────

export const DEFAULT_POLICY: FirewallPolicy = {
  blockPatterns: [
    'ignore previous',
    'ignore the above',
    'disregard prior',
    'system prompt',
    'reveal the instruction',
    'jailbreak',
    '너는 이제',
    '이전 지시 무시',
    '시스템 프롬프트',
  ],
  jailbreakKeywords: [
    'dan mode',
    'developer mode',
    'pretend you have no rules',
    'act as if you have no',
    '규칙 없이',
    '제한 없이 답해',
  ],
  piiPatterns: [
    /\b\d{6}-\d{7}\b/,                  // 주민번호
    /\b\d{3}-\d{2}-\d{5}\b/,            // 사업자번호
    /\b(?:\d[ -]?){13,16}\b/,            // 카드번호
    /\bsk-[A-Za-z0-9]{20,}\b/,           // OpenAI 키
    /AKIA[0-9A-Z]{16}/,                  // AWS 액세스 키
  ],
  thresholds: { block: 0.7, review: 0.4 },
};

// ── SemanticFirewall ─────────────────────────────────────────────────────────

/**
 * 의미 기반 프롬프트 인젝션 방어기.
 * 룰 탐지 → 휴리스틱 점수 → 콘텐츠 분류의 3단계로 판정한다.
 */
export class SemanticFirewall {
  private policy: FirewallPolicy;
  private readonly auditLog: FirewallAuditEntry[] = [];

  constructor(policy: FirewallPolicy = DEFAULT_POLICY) {
    this.validatePolicy(policy);
    this.policy = this.clonePolicy(policy);
  }

  // FR-R59.6: N2SF 등급 검사
  enforceDataGrade(grade: DataGrade): void {
    if (grade === 'C' || grade === 'S') {
      this.audit('GRADE_BLOCKED', 1, [`N2SF ${grade}등급 차단`]);
      throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
    }
  }

  // FR-R59.1: 인젝션 패턴 점수
  detectInjectionPatterns(text: string): number {
    const lower = text.toLowerCase();
    let hits = 0;
    for (const pattern of this.policy.blockPatterns) {
      if (lower.includes(pattern)) hits += 1;
    }
    const denom = Math.max(1, this.policy.blockPatterns.length);
    return Math.min(1, hits / Math.min(3, denom));
  }

  // FR-R59.2: 탈옥 시도 점수
  detectJailbreak(text: string): number {
    const lower = text.toLowerCase();
    let hits = 0;
    for (const kw of this.policy.jailbreakKeywords) {
      if (lower.includes(kw)) hits += 1;
    }
    return hits === 0 ? 0 : Math.min(1, 0.5 + hits * 0.25);
  }

  // FR-R59.3: 콘텐츠 분류
  classifyContent(text: string): { toxic: number; pii: number; secret: number } {
    const toxicWords = ['kill', 'bomb', '폭탄', '살해', 'hate'];
    const lower = text.toLowerCase();
    let toxicHits = 0;
    for (const w of toxicWords) if (lower.includes(w)) toxicHits += 1;

    let piiHits = 0;
    let secretHits = 0;
    for (const re of this.policy.piiPatterns) {
      if (re.test(text)) {
        if (/sk-|AKIA/.test(re.source)) secretHits += 1;
        else piiHits += 1;
      }
    }
    return {
      toxic: Math.min(1, toxicHits * 0.4),
      pii: Math.min(1, piiHits * 0.5),
      secret: Math.min(1, secretHits * 1),
    };
  }

  // FR-R59.1~3 통합
  inspect(prompt: string, ctx: InspectContext = {}): InspectResult {
    if (ctx.grade) {
      try {
        this.enforceDataGrade(ctx.grade);
      } catch (e) {
        const now = new Date().toISOString();
        return {
          decision: 'block',
          score: 1,
          reasons: [(e as Error).message],
          classification: { toxic: 0, pii: 0, secret: 0 },
          timestamp: now,
        };
      }
    }

    const inj = this.detectInjectionPatterns(prompt);
    const jail = this.detectJailbreak(prompt);
    const cls = this.classifyContent(prompt);

    const reasons: string[] = [];
    if (inj > 0) reasons.push(`injection=${inj.toFixed(2)}`);
    if (jail > 0) reasons.push(`jailbreak=${jail.toFixed(2)}`);
    if (cls.toxic > 0) reasons.push(`toxic=${cls.toxic.toFixed(2)}`);
    if (cls.pii > 0) reasons.push(`pii=${cls.pii.toFixed(2)}`);
    if (cls.secret > 0) reasons.push(`secret=${cls.secret.toFixed(2)}`);

    // 인젝션+탈옥 동시 발생은 명백한 공격으로 간주 (곱셈 부스트)
    const combo = inj > 0 && jail > 0 ? 0.2 : 0;
    const score = Math.min(
      1,
      inj * 0.55 + jail * 0.45 + combo + cls.toxic * 0.1 + cls.pii * 0.1 + cls.secret * 0.3,
    );
    let decision: FirewallDecision = 'allow';
    if (score >= this.policy.thresholds.block) decision = 'block';
    else if (score >= this.policy.thresholds.review) decision = 'review';

    const timestamp = new Date().toISOString();
    const result: InspectResult = {
      decision,
      score,
      reasons,
      classification: cls,
      timestamp,
    };

    const action: FirewallAuditEntry['action'] =
      decision === 'block' ? 'BLOCK' : decision === 'review' ? 'REVIEW' : 'ALLOW';
    this.audit(action, score, reasons, ctx);

    return result;
  }

  // FR-R59.4: 정책 핫리로드
  reloadPolicy(policy: FirewallPolicy): void {
    this.validatePolicy(policy);
    this.policy = this.clonePolicy(policy);
    this.audit('POLICY_RELOAD', 0, ['policy replaced']);
  }

  getPolicy(): FirewallPolicy {
    return this.clonePolicy(this.policy);
  }

  // FR-R59.5: 감사 로그
  getAuditLog(limit?: number): FirewallAuditEntry[] {
    const copy = this.auditLog.map((e) => ({ ...e, reasons: [...e.reasons] }));
    if (limit !== undefined && limit > 0) return copy.slice(-limit);
    return copy;
  }

  // ── 내부 ───────────────────────────────────────────────────────────────────

  private audit(
    action: FirewallAuditEntry['action'],
    score: number,
    reasons: string[],
    ctx: InspectContext = {},
  ): void {
    const entry: FirewallAuditEntry = {
      timestamp: new Date().toISOString(),
      action,
      score,
      reasons: [...reasons],
    };
    if (ctx.tenantId !== undefined) entry.tenantId = ctx.tenantId;
    if (ctx.userId !== undefined) entry.userId = ctx.userId;
    this.auditLog.push(entry);
  }

  private validatePolicy(policy: FirewallPolicy): void {
    if (!policy || !Array.isArray(policy.blockPatterns)) {
      throw new Error('FW_INVALID_POLICY');
    }
    const th = policy.thresholds;
    if (!th || th.block <= 0 || th.block > 1 || th.review <= 0 || th.review > 1) {
      throw new Error('FW_INVALID_THRESHOLD');
    }
    if (th.review >= th.block) {
      throw new Error('FW_THRESHOLD_ORDER');
    }
  }

  private clonePolicy(policy: FirewallPolicy): FirewallPolicy {
    return {
      blockPatterns: [...policy.blockPatterns],
      jailbreakKeywords: [...policy.jailbreakKeywords],
      piiPatterns: policy.piiPatterns.map((r) => new RegExp(r.source, r.flags)),
      thresholds: { ...policy.thresholds },
    };
  }
}
