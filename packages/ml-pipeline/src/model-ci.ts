/**
 * 모델 CI 파이프라인 - 학습 → 검증 → 등록
 * Design Ref: MTU-N173 §3.4
 * Plan SC: FR-ML.4
 */

import { z } from 'zod';

// 입력 스키마 (CSAP D-12 준수)
const ModelTrainRequestSchema = z.object({
  experimentName: z.string().min(1),
  modelName: z.string().min(1),
  params: z.record(z.union([z.string(), z.number(), z.boolean()])),
  metrics: z.record(z.number()),
  artifactPath: z.string(),
  tags: z.record(z.string()).optional(),
});

export type ModelTrainRequest = z.infer<typeof ModelTrainRequestSchema>;

interface MLflowConfig {
  trackingUri: string;
  registryUri: string;
}

/**
 * 모델 CI 파이프라인 단계
 */
export enum ModelStage {
  None = 'None',
  Staging = 'Staging',
  Production = 'Production',
  Archived = 'Archived',
}

/**
 * 모델 검증 기준
 */
export interface ModelValidationCriteria {
  /** 최소 정확도 */
  minAccuracy: number;
  /** 최대 추론 시간 (ms) */
  maxInferenceTimeMs: number;
  /** 최대 모델 크기 (MB) */
  maxModelSizeMb: number;
  /** 필수 메트릭 키 목록 */
  requiredMetrics: string[];
}

const DEFAULT_VALIDATION_CRITERIA: ModelValidationCriteria = {
  minAccuracy: 0.85,
  maxInferenceTimeMs: 100,
  maxModelSizeMb: 500,
  requiredMetrics: ['accuracy', 'f1_score', 'precision', 'recall'],
};

/**
 * 모델 CI 파이프라인
 */
export class ModelCIPipeline {
  private config: MLflowConfig;
  private validationCriteria: ModelValidationCriteria;

  constructor(config: MLflowConfig, criteria?: Partial<ModelValidationCriteria>) {
    this.config = config;
    this.validationCriteria = { ...DEFAULT_VALIDATION_CRITERIA, ...criteria };
  }

  /**
   * 1단계: 모델 학습 결과 기록
   */
  async logTrainingRun(request: ModelTrainRequest): Promise<{ runId: string }> {
    const validated = ModelTrainRequestSchema.parse(request);

    // MLflow API 호출 (모의)
    const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Design Ref: MTU-N173 §3.4 — 구조화된 로깅 (CSAP D-06 감사 추적)
    process.stdout.write(JSON.stringify({
      level: 'info', component: 'model-ci', action: 'log_training_run',
      runId, experiment: validated.experimentName, model: validated.modelName,
      params: validated.params, metrics: validated.metrics,
      ts: new Date().toISOString(),
    }) + '\n');

    return { runId };
  }

  /**
   * 2단계: 모델 검증
   */
  async validateModel(
    runId: string,
    metrics: Record<string, number>,
    modelSizeMb: number,
    inferenceTimeMs: number,
  ): Promise<{ passed: boolean; reasons: string[] }> {
    const reasons: string[] = [];

    // 필수 메트릭 확인
    for (const metric of this.validationCriteria.requiredMetrics) {
      if (!(metric in metrics)) {
        reasons.push(`필수 메트릭 누락: ${metric}`);
      }
    }

    // 정확도 기준
    if (metrics.accuracy !== undefined && metrics.accuracy < this.validationCriteria.minAccuracy) {
      reasons.push(
        `정확도 미달: ${metrics.accuracy} < ${this.validationCriteria.minAccuracy}`
      );
    }

    // 추론 시간 기준
    if (inferenceTimeMs > this.validationCriteria.maxInferenceTimeMs) {
      reasons.push(
        `추론 시간 초과: ${inferenceTimeMs}ms > ${this.validationCriteria.maxInferenceTimeMs}ms`
      );
    }

    // 모델 크기 기준
    if (modelSizeMb > this.validationCriteria.maxModelSizeMb) {
      reasons.push(
        `모델 크기 초과: ${modelSizeMb}MB > ${this.validationCriteria.maxModelSizeMb}MB`
      );
    }

    const passed = reasons.length === 0;
    process.stdout.write(JSON.stringify({
      level: passed ? 'info' : 'warn', component: 'model-ci', action: 'validate_model',
      runId, passed, reasons, ts: new Date().toISOString(),
    }) + '\n');

    return { passed, reasons };
  }

  /**
   * 3단계: 모델 레지스트리 등록
   */
  async registerModel(
    runId: string,
    modelName: string,
    stage: ModelStage = ModelStage.Staging,
  ): Promise<{ version: number; stage: ModelStage }> {
    process.stdout.write(JSON.stringify({
      level: 'info', component: 'model-ci', action: 'register_model',
      modelName, stage, runId, ts: new Date().toISOString(),
    }) + '\n');

    // MLflow Model Registry API (모의)
    const version = Math.floor(Math.random() * 100) + 1;

    return { version, stage };
  }

  /**
   * 4단계: 스테이지 전환 (Staging → Production)
   */
  async promoteModel(
    modelName: string,
    version: number,
    targetStage: ModelStage,
  ): Promise<{ success: boolean }> {
    process.stdout.write(JSON.stringify({
      level: targetStage === ModelStage.Production ? 'warn' : 'info',
      component: 'model-ci', action: 'promote_model',
      modelName, version, targetStage,
      notice: targetStage === ModelStage.Production ? '프로덕션 전환 — A/B 테스트 결과 확인 필요' : undefined,
      ts: new Date().toISOString(),
    }) + '\n');

    return { success: true };
  }
}

/**
 * 모델 드리프트 감지기
 * Design Ref: §3.6
 * Plan SC: FR-ML.6
 */
export class ModelDriftDetector {
  private psiThreshold: number;
  private ksThreshold: number;

  constructor(psiThreshold = 0.2, ksThreshold = 0.05) {
    this.psiThreshold = psiThreshold;
    this.ksThreshold = ksThreshold;
  }

  /**
   * Population Stability Index (PSI) 계산
   * 입력 분포 변화 감지
   */
  calculatePSI(
    expected: number[],
    actual: number[],
    bins = 10,
  ): { psi: number; drifted: boolean } {
    if (expected.length === 0 || actual.length === 0) {
      return { psi: 0, drifted: false };
    }

    const min = Math.min(...expected, ...actual);
    const max = Math.max(...expected, ...actual);
    const binWidth = (max - min) / bins;

    let psi = 0;
    for (let i = 0; i < bins; i++) {
      const lower = min + i * binWidth;
      const upper = lower + binWidth;

      const expectedCount = expected.filter(v => v >= lower && v < upper).length;
      const actualCount = actual.filter(v => v >= lower && v < upper).length;

      const expectedPct = Math.max(expectedCount / expected.length, 0.0001);
      const actualPct = Math.max(actualCount / actual.length, 0.0001);

      psi += (actualPct - expectedPct) * Math.log(actualPct / expectedPct);
    }

    return { psi, drifted: psi > this.psiThreshold };
  }

  /**
   * 드리프트 감지 종합 판정
   */
  detect(
    expectedDistribution: number[],
    actualDistribution: number[],
  ): { drifted: boolean; psi: number; recommendation: string } {
    const { psi, drifted } = this.calculatePSI(expectedDistribution, actualDistribution);

    let recommendation = '정상 - 모니터링 유지';
    if (psi > 0.25) {
      recommendation = '심각한 드리프트 - 즉시 모델 재학습 필요';
    } else if (psi > 0.2) {
      recommendation = '경미한 드리프트 - 재학습 검토 필요';
    } else if (psi > 0.1) {
      recommendation = '주의 - 추이 모니터링 강화';
    }

    return { drifted, psi, recommendation };
  }
}
