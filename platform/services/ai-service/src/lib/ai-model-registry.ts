// AI 모델 레지스트리 — FR-ADV25.1~25.6
// Design Ref: SVC-AI-ADV-R25 DESIGN §1~§5
// Plan SC: SC-1 (등록), SC-2 (버전), SC-3 (모델 카드), SC-4 (배포), SC-5 (대시보드)
// CSAP: D-12 모델 무결성, D-06 모델 변경 감사
// N2SF: N-05 모델 메타데이터만 관리 (데이터 전송 없음)

// ── 타입 정의 ────────────────────────────────────────────────────────────────

/** 모델 상태 — Design §2 */
export type ModelStatus = 'draft' | 'active' | 'deprecated' | 'retired';

/** 모델 능력 */
export interface ModelCapability {
  type: 'chat' | 'completion' | 'embedding' | 'multimodal' | 'code';
  maxTokens: number;
  supportedLanguages: string[];
}

/** 모델 가격 */
export interface ModelPricing {
  inputTokenPer1K: number;
  outputTokenPer1K: number;
  currency: string;
}

/** 모델 카드 — Design §3 */
export interface ModelCard {
  description: string;
  trainingData: string;
  benchmarks: Record<string, number>;
  knownBiases: string[];
  usageGuidelines: string[];
  limitations: string[];
}

/** 모델 엔트리 — Design §1 */
export interface ModelEntry {
  id: string;
  name: string;
  provider: string;
  version: string;
  status: ModelStatus;
  capabilities: ModelCapability[];
  pricing: ModelPricing;
  card: ModelCard;
  deployedAt?: string;
  retiredAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** 모델 성능 메트릭 — Design §5 */
export interface ModelPerformanceMetric {
  modelId: string;
  avgLatencyMs: number;
  avgTokensPerSecond: number;
  totalRequests: number;
  errorRate: number;
  avgQualityScore: number;
  costPerRequest: number;
  uptime: number;
  timestamp: string;
}

/** 배포 계획 — Design §4 */
export interface DeploymentPlan {
  modelId: string;
  strategy: 'canary' | 'blue-green' | 'rolling';
  trafficPercent: number;
  targetPercent: number;
  stepPercent: number;
  healthCheckInterval: number;
  rollbackThreshold: number;
}

// ── 모델 레지스트리 — Design §1, §2 ───────────────────────────────────────

/** AI 모델 레지스트리 */
export class AIModelRegistry {
  private readonly models: Map<string, ModelEntry> = new Map();
  private readonly metrics: Map<string, ModelPerformanceMetric[]> = new Map();
  private readonly deployments: Map<string, DeploymentPlan> = new Map();

  /** 모델 등록 — Design §1 */
  register(entry: Omit<ModelEntry, 'createdAt' | 'updatedAt'>): ModelEntry {
    const now = new Date().toISOString();
    const model: ModelEntry = {
      ...entry,
      createdAt: now,
      updatedAt: now,
    };
    this.models.set(model.id, model);
    return model;
  }

  /** 모델 조회 */
  get(modelId: string): ModelEntry | undefined {
    return this.models.get(modelId);
  }

  /** 모델 활성화 — Design §2 */
  activate(modelId: string): ModelEntry | undefined {
    const model = this.models.get(modelId);
    if (!model || model.status === 'retired') return undefined;
    model.status = 'active';
    model.deployedAt = new Date().toISOString();
    model.updatedAt = new Date().toISOString();
    return model;
  }

  /** 모델 비활성화 (deprecated) */
  deprecate(modelId: string): ModelEntry | undefined {
    const model = this.models.get(modelId);
    if (!model) return undefined;
    model.status = 'deprecated';
    model.updatedAt = new Date().toISOString();
    return model;
  }

  /** 모델 은퇴 (retired) */
  retire(modelId: string): ModelEntry | undefined {
    const model = this.models.get(modelId);
    if (!model) return undefined;
    model.status = 'retired';
    model.retiredAt = new Date().toISOString();
    model.updatedAt = new Date().toISOString();
    return model;
  }

  /** 활성 모델 목록 */
  getActiveModels(): ModelEntry[] {
    return [...this.models.values()].filter((m) => m.status === 'active');
  }

  /** 능력 기반 모델 검색 */
  findByCapability(type: ModelCapability['type']): ModelEntry[] {
    return [...this.models.values()].filter(
      (m) => m.status === 'active' && m.capabilities.some((c) => c.type === type),
    );
  }

  /** 전체 모델 목록 */
  list(): ModelEntry[] {
    return [...this.models.values()];
  }

  // ── 성능 메트릭 — Design §5 ───────────────────────────────────────────

  /** 메트릭 기록 */
  recordMetric(metric: ModelPerformanceMetric): void {
    const existing = this.metrics.get(metric.modelId) ?? [];
    existing.push(metric);
    // 최대 1000건 유지
    if (existing.length > 1000) {
      existing.splice(0, existing.length - 1000);
    }
    this.metrics.set(metric.modelId, existing);
  }

  /** 모델 성능 요약 */
  getPerformanceSummary(modelId: string): ModelPerformanceMetric | undefined {
    const entries = this.metrics.get(modelId);
    if (!entries || entries.length === 0) return undefined;

    const total = entries.length;
    return {
      modelId,
      avgLatencyMs: entries.reduce((s, e) => s + e.avgLatencyMs, 0) / total,
      avgTokensPerSecond: entries.reduce((s, e) => s + e.avgTokensPerSecond, 0) / total,
      totalRequests: entries.reduce((s, e) => s + e.totalRequests, 0),
      errorRate: entries.reduce((s, e) => s + e.errorRate, 0) / total,
      avgQualityScore: entries.reduce((s, e) => s + e.avgQualityScore, 0) / total,
      costPerRequest: entries.reduce((s, e) => s + e.costPerRequest, 0) / total,
      uptime: entries.reduce((s, e) => s + e.uptime, 0) / total,
      timestamp: new Date().toISOString(),
    };
  }

  // ── 배포 전략 — Design §4 ─────────────────────────────────────────────

  /** 배포 계획 생성 */
  createDeployment(plan: DeploymentPlan): void {
    this.deployments.set(plan.modelId, plan);
  }

  /** 배포 계획 조회 */
  getDeployment(modelId: string): DeploymentPlan | undefined {
    return this.deployments.get(modelId);
  }

  /** 트래픽 비율 증가 (카나리 진행) */
  advanceDeployment(modelId: string): DeploymentPlan | undefined {
    const plan = this.deployments.get(modelId);
    if (!plan) return undefined;

    plan.trafficPercent = Math.min(
      plan.trafficPercent + plan.stepPercent,
      plan.targetPercent,
    );

    return plan;
  }

  /** 배포 롤백 */
  rollbackDeployment(modelId: string): DeploymentPlan | undefined {
    const plan = this.deployments.get(modelId);
    if (!plan) return undefined;
    plan.trafficPercent = 0;
    return plan;
  }

  /** 모델 수 */
  get size(): number {
    return this.models.size;
  }
}
