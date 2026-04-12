// Agentic Code Reviewer — FR-R81.1~R81.5
// Design Ref: SVC-AI-ADV-R81 DESIGN §파이프라인
// Plan SC: 이슈 검출률 ≥ 85%, C/S 등급 차단
// CSAP: D-12 시스템 개발 보안, D-06 감사 / N2SF: N-05

export type DataGrade = 'C' | 'S' | 'O';
export type StepName = 'design' | 'security' | 'quality' | 'compliance';
export type Verdict = 'pass' | 'warn' | 'fail';
export type FinalVerdict = 'allow' | 'warn' | 'block';

export interface PatchHunk {
  file: string;
  added: string[];
  removed: string[];
}

export interface ReviewRequest {
  id: string;
  tenantId: string;
  author: string;
  hunks: PatchHunk[];
  grade: DataGrade;
  tags?: string[];
}

export interface StepResult {
  step: StepName;
  verdict: Verdict;
  findings: string[];
  rationale: string;
}

export interface ReviewResult {
  requestId: string;
  verdict: FinalVerdict;
  steps: StepResult[];
  reason: string;
}

export type StepExecutor = (req: ReviewRequest) => Promise<StepResult>;

export interface AgenticReviewerOptions {
  executors?: Partial<Record<StepName, StepExecutor>>;
  blockOnComplianceFail: boolean;
}

export type AuditAction =
  | 'REVIEW_START'
  | 'STEP'
  | 'BLOCKED'
  | 'WARN'
  | 'ALLOWED'
  | 'GRADE_BLOCKED'
  | 'PATTERN_HIT';

export interface AuditEvent {
  action: AuditAction;
  detail?: string;
  at: number;
}

const DEFAULT_OPTS: AgenticReviewerOptions = {
  blockOnComplianceFail: true,
};

const SECRET_PATTERNS: RegExp[] = [
  /api[_-]?key\s*=\s*['"][^'"]+['"]/i,
  /password\s*=\s*['"][^'"]+['"]/i,
  /secret\s*=\s*['"][^'"]{6,}['"]/i,
  /token\s*=\s*['"][^'"]{10,}['"]/i,
];

const SQL_INJECT_PATTERNS: RegExp[] = [
  /execute\s*\(\s*[`'"].*\$\{.*\}/i,
  /query\s*\(\s*[`'"][^)]*\$\{.*\}/i,
];

const PLAINTEXT_PWD_PATTERNS: RegExp[] = [
  /db\.create\s*\(\s*\{[^}]*password\s*:\s*[a-zA-Z_]+\s*\}/,
  /INSERT[^;]+password[^;]+VALUES[^;]+\$\{/i,
];

const XSS_PATTERNS: RegExp[] = [
  /innerHTML\s*=\s*[^;]+\+/,
  /document\.write\s*\(/,
];

export class AgenticCodeReviewer {
  private readonly opts: AgenticReviewerOptions;
  private readonly auditLog: AuditEvent[] = [];
  private readonly executors: Record<StepName, StepExecutor>;
  private readonly extraPatterns: Record<StepName, RegExp[]> = {
    design: [],
    security: [],
    quality: [],
    compliance: [],
  };

  constructor(opts: Partial<AgenticReviewerOptions> = {}) {
    this.opts = { ...DEFAULT_OPTS, ...opts };
    this.executors = {
      design: opts.executors?.design ?? ((r) => this.defaultDesign(r)),
      security: opts.executors?.security ?? ((r) => this.defaultSecurity(r)),
      quality: opts.executors?.quality ?? ((r) => this.defaultQuality(r)),
      compliance: opts.executors?.compliance ?? ((r) => this.defaultCompliance(r)),
    };
  }

  addPattern(step: StepName, regex: RegExp): void {
    this.extraPatterns[step].push(regex);
  }

  async review(request: ReviewRequest): Promise<ReviewResult> {
    if (request.grade !== 'O') {
      this.audit('GRADE_BLOCKED', `${request.id} grade=${request.grade}`);
      throw new Error('REVIEW_GRADE_BLOCKED');
    }
    this.audit('REVIEW_START', request.id);

    const steps: StepResult[] = [];
    const stepOrder: StepName[] = ['design', 'security', 'quality', 'compliance'];

    for (const name of stepOrder) {
      const executor = this.executors[name];
      const result = await executor(request);
      steps.push(result);
      this.audit('STEP', `${request.id}:${name}=${result.verdict}`);
    }

    const complianceStep = steps.find((s) => s.step === 'compliance');
    const hasFail = steps.some((s) => s.verdict === 'fail');
    const hasWarn = steps.some((s) => s.verdict === 'warn');
    const complianceFailed = complianceStep?.verdict === 'fail';

    let verdict: FinalVerdict;
    let reason: string;

    if (complianceFailed && this.opts.blockOnComplianceFail) {
      verdict = 'block';
      reason = 'compliance-step-failed';
    } else if (hasFail) {
      verdict = 'block';
      reason = 'one-or-more-steps-failed';
    } else if (hasWarn) {
      verdict = 'warn';
      reason = 'one-or-more-steps-warned';
    } else {
      verdict = 'allow';
      reason = 'all-steps-passed';
    }

    if (verdict === 'block') {
      this.audit('BLOCKED', `${request.id}:${reason}`);
    } else if (verdict === 'warn') {
      this.audit('WARN', `${request.id}:${reason}`);
    } else {
      this.audit('ALLOWED', `${request.id}`);
    }

    return { requestId: request.id, verdict, steps, reason };
  }

  getAuditLog(): AuditEvent[] {
    return [...this.auditLog];
  }

  private audit(action: AuditAction, detail?: string): void {
    this.auditLog.push({ action, detail, at: Date.now() });
  }

  // -- Default executors ------------------------------------------------------

  private async defaultDesign(req: ReviewRequest): Promise<StepResult> {
    const findings: string[] = [];
    const fileCount = new Set(req.hunks.map((h) => h.file)).size;
    const totalAdded = req.hunks.reduce((sum, h) => sum + h.added.length, 0);

    if (fileCount > 20) {
      findings.push(`파일 수 과다 (${fileCount}개, 권장 ≤ 20)`);
    }
    if (totalAdded > 500) {
      findings.push(`추가 라인 과다 (${totalAdded}줄, 권장 ≤ 500)`);
    }
    if (req.hunks.length === 0) {
      findings.push('빈 패치');
    }

    const verdict: Verdict = findings.length === 0 ? 'pass' : 'warn';
    return {
      step: 'design',
      verdict,
      findings,
      rationale: `파일 ${fileCount}개, +${totalAdded}줄`,
    };
  }

  private async defaultSecurity(req: ReviewRequest): Promise<StepResult> {
    const findings: string[] = [];
    const patterns = [...SECRET_PATTERNS, ...SQL_INJECT_PATTERNS, ...XSS_PATTERNS, ...this.extraPatterns.security];

    for (const hunk of req.hunks) {
      for (const line of hunk.added) {
        for (const pattern of patterns) {
          if (pattern.test(line)) {
            findings.push(`${hunk.file}: 보안 패턴 매칭 (${pattern.source.slice(0, 30)})`);
            this.audit('PATTERN_HIT', `${req.id}:security`);
          }
        }
      }
    }

    const verdict: Verdict = findings.length === 0 ? 'pass' : 'fail';
    return {
      step: 'security',
      verdict,
      findings,
      rationale: findings.length === 0 ? '보안 패턴 미탐지' : `${findings.length}건 탐지`,
    };
  }

  private async defaultQuality(req: ReviewRequest): Promise<StepResult> {
    const findings: string[] = [];
    const maxLineLen = 120;

    for (const hunk of req.hunks) {
      for (const line of hunk.added) {
        if (line.length > maxLineLen) {
          findings.push(`${hunk.file}: 라인 길이 ${line.length} > ${maxLineLen}`);
        }
        const depth = this.nestingDepth(line);
        if (depth > 4) {
          findings.push(`${hunk.file}: 중첩 깊이 ${depth} > 4`);
        }
      }
    }

    const verdict: Verdict = findings.length === 0 ? 'pass' : findings.length > 5 ? 'fail' : 'warn';
    return {
      step: 'quality',
      verdict,
      findings,
      rationale: `품질 이슈 ${findings.length}건`,
    };
  }

  private async defaultCompliance(req: ReviewRequest): Promise<StepResult> {
    const findings: string[] = [];
    const patterns = [...PLAINTEXT_PWD_PATTERNS, ...this.extraPatterns.compliance];

    for (const hunk of req.hunks) {
      for (const line of hunk.added) {
        for (const pattern of patterns) {
          if (pattern.test(line)) {
            findings.push(`${hunk.file}: CSAP 위반 패턴 (${pattern.source.slice(0, 30)})`);
            this.audit('PATTERN_HIT', `${req.id}:compliance`);
          }
        }
        // 인증 없는 쿼리 탐지
        if (/db\.(query|execute)\s*\(/.test(line) && !/auth|verify|permission/i.test(line)) {
          const context = req.hunks.flatMap((h) => h.added).join('\n');
          if (!/verifyToken|hasPermission/.test(context)) {
            findings.push(`${hunk.file}: 인증 검사 없이 DB 접근 (CSAP D-08)`);
          }
        }
      }
    }

    const verdict: Verdict = findings.length === 0 ? 'pass' : 'fail';
    return {
      step: 'compliance',
      verdict,
      findings,
      rationale: findings.length === 0 ? 'CSAP 위반 없음' : `${findings.length}건 위반`,
    };
  }

  private nestingDepth(line: string): number {
    let depth = 0;
    let max = 0;
    for (const ch of line) {
      if (ch === '{' || ch === '(') {
        depth += 1;
        if (depth > max) {
          max = depth;
        }
      } else if (ch === '}' || ch === ')') {
        depth = Math.max(0, depth - 1);
      }
    }
    return max;
  }
}
