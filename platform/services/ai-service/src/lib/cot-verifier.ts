// Chain-of-Thought Verifier — FR-R72.1~R72.5
// Design Ref: SVC-AI-ADV-R72 DESIGN §모듈
// Plan SC: 논리 오류 탐지 ≥ 85%, 거짓 통과 < 5%
// CSAP: D-06 감사
// N2SF: N-05 등급

export type DataGrade = 'C' | 'S' | 'O';

export interface CoTStep {
  index: number;
  text: string;
  claims: string[];
  refs: number[];
  numbers: number[];
}

export interface CoTDocument {
  id: string;
  steps: CoTStep[];
  conclusion: string;
  grade: DataGrade;
}

export type IssueKind =
  | 'missing-ref'
  | 'circular-ref'
  | 'numeric-inconsistency'
  | 'contradiction'
  | 'orphan-step'
  | 'unsupported-conclusion';

export type IssueSeverity = 'info' | 'warn' | 'error';

export interface VerificationIssue {
  stepIndex: number;
  kind: IssueKind;
  message: string;
  severity: IssueSeverity;
}

export interface VerificationReport {
  docId: string;
  score: number;
  passed: boolean;
  issues: VerificationIssue[];
  verifiedAt: number;
}

export interface AuditEvent {
  event: 'VERIFY' | 'ISSUE_FOUND' | 'GRADE_BLOCK';
  docId: string;
  detail?: string;
  at: number;
}

const STEP_HEADING = /^\s*(?:Step|단계)\s*(\d+)\s*[:：]\s*(.*)$/i;
const REF_PATTERN = /(?:\(step\s*(\d+)\)|\[ref:\s*(\d+)\]|단계\s*(\d+))/gi;
const NUMBER_PATTERN = /-?\d+(?:\.\d+)?/g;
const CONCLUSION_PREFIX = /^(?:therefore|thus|결론|따라서)\s*[:：]?\s*/i;
const NEGATION_PATTERN = /(?:not|no|아니|없)/i;

export class CoTVerifier {
  private readonly audit: AuditEvent[] = [];

  // ── 파싱 ──────────────────────────────────────────────────────────────────
  parse(text: string, docId: string, grade: DataGrade): CoTDocument {
    if (grade === 'C' || grade === 'S') {
      this.audit.push({
        event: 'GRADE_BLOCK',
        docId,
        detail: `parse grade=${grade}`,
        at: Date.now(),
      });
      throw new Error('COT_GRADE_BLOCKED');
    }

    const lines = text.split(/\r?\n/);
    const steps: CoTStep[] = [];
    let conclusion = '';

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const m = STEP_HEADING.exec(line);
      if (m) {
        const idx = parseInt(m[1] ?? '0', 10);
        const body = m[2] ?? '';
        steps.push({
          index: idx,
          text: body,
          claims: [body],
          refs: this.extractRefs(body),
          numbers: this.extractNumbers(body),
        });
        continue;
      }
      if (CONCLUSION_PREFIX.test(line)) {
        conclusion = line.replace(CONCLUSION_PREFIX, '');
        continue;
      }
      // step 본문 이어쓰기
      const last = steps[steps.length - 1];
      if (last) {
        last.text += ' ' + line;
        last.claims.push(line);
        last.refs.push(...this.extractRefs(line));
        last.numbers.push(...this.extractNumbers(line));
      }
    }

    if (!conclusion && steps.length > 0) {
      conclusion = steps[steps.length - 1]?.text ?? '';
    }

    return { id: docId, steps, conclusion, grade };
  }

  // ── 검증 ──────────────────────────────────────────────────────────────────
  verify(doc: CoTDocument): VerificationReport {
    const issues: VerificationIssue[] = [];
    const indexSet = new Set(doc.steps.map((s) => s.index));

    for (const step of doc.steps) {
      // 1. missing-ref
      for (const ref of step.refs) {
        if (!indexSet.has(ref)) {
          issues.push({
            stepIndex: step.index,
            kind: 'missing-ref',
            severity: 'error',
            message: `step ${step.index} references unknown step ${ref}`,
          });
        }
      }

      // 3. numeric-inconsistency
      for (const ref of step.refs) {
        const refStep = doc.steps.find((s) => s.index === ref);
        if (!refStep) continue;
        if (step.numbers.length === 0 || refStep.numbers.length === 0) continue;
        const stepNum = step.numbers[0];
        const refNum = refStep.numbers[0];
        if (stepNum === undefined || refNum === undefined) continue;
        if (!this.numbersClose(stepNum, refNum)) {
          issues.push({
            stepIndex: step.index,
            kind: 'numeric-inconsistency',
            severity: 'warn',
            message: `numeric drift: ${stepNum} vs ref step ${ref} ${refNum}`,
          });
        }
      }

      // 4. contradiction
      if (this.hasContradiction(step.text)) {
        issues.push({
          stepIndex: step.index,
          kind: 'contradiction',
          severity: 'warn',
          message: `possible contradiction in step ${step.index}`,
        });
      }
    }

    // 2. circular-ref (DFS)
    const cycleNodes = this.detectCycles(doc.steps);
    for (const idx of cycleNodes) {
      issues.push({
        stepIndex: idx,
        kind: 'circular-ref',
        severity: 'error',
        message: `cyclic reference involving step ${idx}`,
      });
    }

    // 5. orphan-step
    const referenced = new Set<number>();
    for (const s of doc.steps) {
      for (const r of s.refs) referenced.add(r);
    }
    for (const s of doc.steps) {
      if (!referenced.has(s.index) && s.index !== doc.steps.length) {
        issues.push({
          stepIndex: s.index,
          kind: 'orphan-step',
          severity: 'info',
          message: `step ${s.index} is not referenced by any other step`,
        });
      }
    }

    // 6. unsupported-conclusion
    const concRefs = this.extractRefs(doc.conclusion);
    if (doc.conclusion && concRefs.length === 0 && doc.steps.length > 0) {
      issues.push({
        stepIndex: doc.steps.length,
        kind: 'unsupported-conclusion',
        severity: 'error',
        message: 'conclusion does not cite any step',
      });
    }

    // score
    let errors = 0;
    let warns = 0;
    for (const i of issues) {
      if (i.severity === 'error') errors += 1;
      if (i.severity === 'warn') warns += 1;
    }
    const score = Math.max(0, 1 - (errors * 0.25 + warns * 0.1));
    const passed = score >= 0.7 && errors === 0;

    const report: VerificationReport = {
      docId: doc.id,
      score,
      passed,
      issues,
      verifiedAt: Date.now(),
    };

    this.audit.push({
      event: 'VERIFY',
      docId: doc.id,
      detail: `score=${score.toFixed(2)} issues=${issues.length}`,
      at: report.verifiedAt,
    });
    if (issues.length > 0) {
      this.audit.push({
        event: 'ISSUE_FOUND',
        docId: doc.id,
        detail: `err=${errors} warn=${warns}`,
        at: report.verifiedAt,
      });
    }
    return report;
  }

  verifyText(text: string, docId: string, grade: DataGrade): VerificationReport {
    const doc = this.parse(text, docId, grade);
    return this.verify(doc);
  }

  getAuditLog(): AuditEvent[] {
    return this.audit.map((e) => ({ ...e }));
  }

  // ── 내부 헬퍼 ────────────────────────────────────────────────────────────
  private extractRefs(text: string): number[] {
    const refs: number[] = [];
    const re = new RegExp(REF_PATTERN.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const raw = m[1] ?? m[2] ?? m[3] ?? '';
      const v = parseInt(raw, 10);
      if (Number.isFinite(v)) refs.push(v);
    }
    return refs;
  }

  private extractNumbers(text: string): number[] {
    const nums: number[] = [];
    const re = new RegExp(NUMBER_PATTERN.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const v = parseFloat(m[0]);
      if (Number.isFinite(v)) nums.push(v);
    }
    // step 번호로 이미 참조된 값 제거 (step index 형태)
    return nums;
  }

  private numbersClose(a: number, b: number): boolean {
    if (a === b) return true;
    const diff = Math.abs(a - b);
    const base = Math.max(Math.abs(a), Math.abs(b));
    if (base === 0) return diff === 0;
    return diff / base <= 0.01;
  }

  private hasContradiction(text: string): boolean {
    // 한 단계 내 긍정/부정 동시 출현 간이 검출
    const lower = text.toLowerCase();
    const hasNeg = NEGATION_PATTERN.test(lower);
    const hasAffirm = /(is|was|이다|있)/.test(lower);
    if (!hasNeg || !hasAffirm) return false;
    // 동일 토큰이 긍정/부정 문구 양쪽에 포함되는지
    const tokens = lower
      .split(/[^a-z0-9가-힣]+/)
      .filter((t) => t.length >= 3);
    const counts = new Map<string, number>();
    for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
    for (const [, v] of counts) {
      if (v >= 2) return true;
    }
    return false;
  }

  private detectCycles(steps: CoTStep[]): number[] {
    const graph = new Map<number, number[]>();
    for (const s of steps) {
      graph.set(s.index, s.refs.filter((r) => r !== s.index));
    }
    const visited = new Set<number>();
    const stack = new Set<number>();
    const cyclic = new Set<number>();

    const dfs = (node: number): boolean => {
      if (stack.has(node)) {
        cyclic.add(node);
        return true;
      }
      if (visited.has(node)) return false;
      visited.add(node);
      stack.add(node);
      const next = graph.get(node) ?? [];
      for (const n of next) {
        if (dfs(n)) {
          cyclic.add(node);
        }
      }
      stack.delete(node);
      return cyclic.has(node);
    };

    for (const s of steps) {
      dfs(s.index);
    }
    return Array.from(cyclic);
  }
}
