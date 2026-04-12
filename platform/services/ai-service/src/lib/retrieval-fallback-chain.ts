// Retrieval Fallback Chain — FR-R62.1~R62.6
// Design Ref: SVC-AI-ADV-R62 DESIGN §모듈 구조
// Plan SC: 검색 실패율 50% 감소, p95 < 2s
// CSAP: D-06 감사 / D-12 입력검증
// N2SF: N-04 외부연동 / N-05 등급

// ── 타입 ─────────────────────────────────────────────────────────────────────

export type DataGrade = 'C' | 'S' | 'O';
export type StageKind = 'bm25' | 'dense' | 'web' | 'llm';

export interface SearchResult {
  docId: string;
  score: number;
  source: string;
  snippet: string;
}

export interface RetrievalStage {
  id: string;
  kind: StageKind;
  /** 외부 네트워크 접근 필요 여부 */
  external: boolean;
  /** 단건 타임아웃 (ms) */
  timeoutMs: number;
  run(query: string): Promise<SearchResult[]>;
}

export interface ChainOpts {
  /** 전체 타임아웃 */
  maxTotalMs: number;
  /** 이 점수 이상이면 조기 종료 */
  scoreThreshold: number;
  /** 요청 등급 */
  grade: DataGrade;
  /** 반환 Top-K */
  topK: number;
}

export interface ChainResult {
  results: SearchResult[];
  stagesRun: string[];
  succeededStage: string | null;
  totalMs: number;
}

export interface ChainAuditEntry {
  timestamp: string;
  action:
    | 'STAGE_REGISTER'
    | 'STAGE_RUN'
    | 'STAGE_SKIP'
    | 'STAGE_FAIL'
    | 'CHAIN_SUCCESS'
    | 'CHAIN_EXHAUSTED'
    | 'TIMEOUT'
    | 'GRADE_BLOCKED';
  stageId?: string;
  detail?: string;
}

// ── RetrievalFallbackChain ──────────────────────────────────────────────────

export class RetrievalFallbackChain {
  private readonly stages: RetrievalStage[] = [];
  private readonly auditLog: ChainAuditEntry[] = [];

  // FR-R62.1
  registerStage(stage: RetrievalStage): void {
    if (!stage.id) throw new Error('CH_INVALID_STAGE');
    if (stage.timeoutMs <= 0) throw new Error('CH_INVALID_TIMEOUT');
    if (this.stages.some((s) => s.id === stage.id)) {
      throw new Error('CH_DUP_STAGE');
    }
    this.stages.push(stage);
    this.audit('STAGE_REGISTER', stage.id);
  }

  listStages(): RetrievalStage[] {
    return this.stages.map((s) => ({ ...s }));
  }

  // FR-R62.5: 등급별 스테이지 제한
  restrictByGrade(grade: DataGrade): RetrievalStage[] {
    if (grade === 'C' || grade === 'S') {
      return this.stages.filter((s) => !s.external);
    }
    return [...this.stages];
  }

  enforceDataGrade(grade: DataGrade, hasExternalOnly: boolean): void {
    if ((grade === 'C' || grade === 'S') && hasExternalOnly) {
      this.audit('GRADE_BLOCKED', undefined, `N2SF ${grade}`);
      throw new Error(
        `BLOCKED: ${grade}등급 요청은 외부 검색 단계로만 처리 불가 (N2SF N-05)`,
      );
    }
  }

  // FR-R62.3
  evaluateQuality(results: SearchResult[]): number {
    if (results.length === 0) return 0;
    let total = 0;
    for (const r of results) total += r.score;
    return Math.min(1, total / results.length);
  }

  // FR-R62.2: 체인 실행
  async search(query: string, opts: ChainOpts): Promise<ChainResult> {
    if (opts.topK <= 0) throw new Error('CH_INVALID_TOPK');
    if (opts.maxTotalMs <= 0) throw new Error('CH_INVALID_TIMEOUT');

    const allowed = this.restrictByGrade(opts.grade);
    if (allowed.length === 0) {
      this.enforceDataGrade(opts.grade, true);
      throw new Error('CH_NO_STAGE_ALLOWED');
    }

    const start = Date.now();
    const stagesRun: string[] = [];
    let best: SearchResult[] = [];
    let bestScore = -1;
    let succeededStage: string | null = null;

    for (const stage of allowed) {
      const elapsed = Date.now() - start;
      if (elapsed >= opts.maxTotalMs) {
        this.audit('TIMEOUT', stage.id, `elapsed=${elapsed}`);
        break;
      }
      const remaining = opts.maxTotalMs - elapsed;
      const budget = Math.min(stage.timeoutMs, remaining);

      stagesRun.push(stage.id);
      try {
        const res = await this.runWithTimeout(stage.run(query), budget);
        this.audit('STAGE_RUN', stage.id, `count=${res.length}`);
        const q = this.evaluateQuality(res);
        if (q > bestScore) {
          bestScore = q;
          best = res;
        }
        if (q >= opts.scoreThreshold && res.length > 0) {
          succeededStage = stage.id;
          break;
        }
      } catch (e) {
        this.audit('STAGE_FAIL', stage.id, (e as Error).message);
      }
    }

    const sliced = best.slice(0, opts.topK);
    const totalMs = Date.now() - start;

    if (succeededStage) {
      this.audit('CHAIN_SUCCESS', succeededStage, `score=${bestScore.toFixed(2)}`);
    } else {
      this.audit('CHAIN_EXHAUSTED', undefined, `best=${bestScore.toFixed(2)}`);
    }

    return {
      results: sliced,
      stagesRun,
      succeededStage,
      totalMs,
    };
  }

  getAuditLog(limit?: number): ChainAuditEntry[] {
    const copy = this.auditLog.map((e) => ({ ...e }));
    if (limit !== undefined && limit > 0) return copy.slice(-limit);
    return copy;
  }

  // ── 내부 ───────────────────────────────────────────────────────────────────

  private async runWithTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('CH_STAGE_TIMEOUT')), ms);
      p.then(
        (v) => {
          clearTimeout(t);
          resolve(v);
        },
        (e) => {
          clearTimeout(t);
          reject(e instanceof Error ? e : new Error(String(e)));
        },
      );
    });
  }

  private audit(
    action: ChainAuditEntry['action'],
    stageId?: string,
    detail?: string,
  ): void {
    const entry: ChainAuditEntry = {
      timestamp: new Date().toISOString(),
      action,
    };
    if (stageId !== undefined) entry.stageId = stageId;
    if (detail !== undefined) entry.detail = detail;
    this.auditLog.push(entry);
  }
}
