// Design Ref: MTU-N441 §온프레미스 LLM 라우터
// Plan SC: FR-N441.1~5

export type DataGrade = 'O' | 'C' | 'S';
export type ModelLocation = 'local' | 'cloud';

export interface ModelProfile {
  modelId: string;
  location: ModelLocation;
  contextWindow: number;
  costPer1kTokenKrw: number;
  avgLatencyMs: number;
  supportedLanguages: string[];
}

export interface RouteRequest {
  dataGrade: DataGrade;
  requiredContextTokens: number;
  language: string;
  maxLatencyMs?: number;
  maxCostKrw?: number;
}

export interface RouteDecision {
  modelId: string;
  location: ModelLocation;
  reason: string;
  fallbackChain: string[];
}

export interface RouterAuditEntry {
  timestamp: string;
  dataGrade: DataGrade;
  decidedModel: string;
  allowedLocations: ModelLocation[];
}

export class OnpremLlmRouter {
  /** FR-N441.1 데이터 등급별 허용 위치 */
  allowedLocations(grade: DataGrade): ModelLocation[] {
    if (grade === 'O') return ['local', 'cloud'];
    return ['local'];
  }

  /** FR-N441.2 모델 능력 필터링 */
  filterCapable(models: ModelProfile[], req: RouteRequest): ModelProfile[] {
    const allowed = this.allowedLocations(req.dataGrade);
    return models.filter(
      (m) =>
        allowed.includes(m.location) &&
        m.contextWindow >= req.requiredContextTokens &&
        m.supportedLanguages.includes(req.language),
    );
  }

  /** FR-N441.3 최적화 스코어링 */
  scoreModel(model: ModelProfile, req: RouteRequest): number {
    const costPenalty = model.costPer1kTokenKrw / 100;
    const latencyPenalty = model.avgLatencyMs / 1000;
    let score = 1 - costPenalty * 0.5 - latencyPenalty * 0.5;
    if (req.maxLatencyMs && model.avgLatencyMs > req.maxLatencyMs) score -= 0.3;
    if (req.maxCostKrw && model.costPer1kTokenKrw > req.maxCostKrw) score -= 0.3;
    return +score.toFixed(3);
  }

  /** FR-N441.4 폴백 체인 구성 */
  route(models: ModelProfile[], req: RouteRequest): RouteDecision {
    const capable = this.filterCapable(models, req);
    if (capable.length === 0) {
      throw new Error('적합한 모델 없음 (등급/컨텍스트/언어 요건 미충족)');
    }
    const ranked = capable
      .map((m) => ({ m, score: this.scoreModel(m, req) }))
      .sort((a, b) => b.score - a.score);
    const winner = ranked[0]?.m;
    if (!winner) throw new Error('라우팅 실패');
    return {
      modelId: winner.modelId,
      location: winner.location,
      reason: `최고 점수 ${ranked[0]?.score}, 허용위치 ${this.allowedLocations(req.dataGrade).join(',')}`,
      fallbackChain: ranked.slice(1).map((r) => r.m.modelId),
    };
  }

  /** FR-N441.5 감사 로그 생성 */
  auditDecision(req: RouteRequest, decision: RouteDecision, timestamp: string): RouterAuditEntry {
    return {
      timestamp,
      dataGrade: req.dataGrade,
      decidedModel: decision.modelId,
      allowedLocations: this.allowedLocations(req.dataGrade),
    };
  }
}

export const onpremLlmRouter = new OnpremLlmRouter();
