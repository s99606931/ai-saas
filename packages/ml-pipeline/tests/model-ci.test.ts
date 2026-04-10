/**
 * 모델 CI 파이프라인 테스트
 * Design Ref: MTU-N173 §3.4, §3.6
 * Plan SC: FR-ML.4, FR-ML.6
 */

import { ModelCIPipeline, ModelStage, ModelDriftDetector } from '../src/model-ci';

describe('ModelCIPipeline', () => {
  let pipeline: ModelCIPipeline;

  beforeEach(() => {
    pipeline = new ModelCIPipeline({
      trackingUri: 'http://mlflow:5000',
      registryUri: 'http://mlflow:5000',
    });
  });

  describe('validateModel', () => {
    it('모든 기준 충족 시 PASS', async () => {
      const result = await pipeline.validateModel(
        'run_123',
        { accuracy: 0.92, f1_score: 0.90, precision: 0.91, recall: 0.89 },
        200, // MB
        50,  // ms
      );
      expect(result.passed).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it('정확도 미달 시 FAIL', async () => {
      const result = await pipeline.validateModel(
        'run_456',
        { accuracy: 0.70, f1_score: 0.68, precision: 0.72, recall: 0.65 },
        200,
        50,
      );
      expect(result.passed).toBe(false);
      expect(result.reasons.some(r => r.includes('정확도 미달'))).toBe(true);
    });

    it('추론 시간 초과 시 FAIL', async () => {
      const result = await pipeline.validateModel(
        'run_789',
        { accuracy: 0.95, f1_score: 0.93, precision: 0.94, recall: 0.92 },
        200,
        500, // 500ms > 100ms
      );
      expect(result.passed).toBe(false);
      expect(result.reasons.some(r => r.includes('추론 시간 초과'))).toBe(true);
    });

    it('필수 메트릭 누락 시 FAIL', async () => {
      const result = await pipeline.validateModel(
        'run_abc',
        { accuracy: 0.95 }, // f1_score, precision, recall 누락
        200,
        50,
      );
      expect(result.passed).toBe(false);
      expect(result.reasons.filter(r => r.includes('필수 메트릭 누락')).length).toBe(3);
    });
  });

  describe('registerModel', () => {
    it('Staging 스테이지로 등록', async () => {
      const result = await pipeline.registerModel('run_123', 'text-classifier');
      expect(result.stage).toBe(ModelStage.Staging);
      expect(result.version).toBeGreaterThan(0);
    });
  });

  describe('promoteModel', () => {
    it('Production 스테이지로 전환', async () => {
      const result = await pipeline.promoteModel('text-classifier', 5, ModelStage.Production);
      expect(result.success).toBe(true);
    });
  });
});

describe('ModelDriftDetector', () => {
  let detector: ModelDriftDetector;

  beforeEach(() => {
    detector = new ModelDriftDetector(0.2, 0.05);
  });

  describe('calculatePSI', () => {
    it('동일 분포 → PSI ≈ 0', () => {
      const data = Array.from({ length: 1000 }, () => Math.random());
      const result = detector.calculatePSI(data, data);
      expect(result.psi).toBeCloseTo(0, 1);
      expect(result.drifted).toBe(false);
    });

    it('다른 분포 → PSI > threshold', () => {
      const expected = Array.from({ length: 1000 }, () => Math.random() * 10);
      const actual = Array.from({ length: 1000 }, () => Math.random() * 10 + 5);
      const result = detector.calculatePSI(expected, actual);
      expect(result.psi).toBeGreaterThan(0);
    });

    it('빈 배열 처리', () => {
      const result = detector.calculatePSI([], []);
      expect(result.psi).toBe(0);
      expect(result.drifted).toBe(false);
    });
  });

  describe('detect', () => {
    it('정상 분포 → 드리프트 없음', () => {
      const data = Array.from({ length: 1000 }, () => Math.random());
      const result = detector.detect(data, data);
      expect(result.drifted).toBe(false);
      expect(result.recommendation).toContain('정상');
    });
  });
});
