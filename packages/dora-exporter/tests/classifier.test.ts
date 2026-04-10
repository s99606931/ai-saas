/**
 * DORA 등급 분류기 테스트
 * Design Ref: MTU-N169 §3.8
 * Plan SC: FR-DORA.8
 */

import { DORAClassifier, DORALevel } from '../src/classifier';

describe('DORAClassifier', () => {
  let classifier: DORAClassifier;

  beforeEach(() => {
    classifier = new DORAClassifier();
  });

  describe('classify', () => {
    it('Elite 등급 - 모든 지표 최상위', () => {
      const result = classifier.classify({
        deploymentFrequency: 5,     // 일 5회
        leadTimeSeconds: 1800,      // 30분
        changeFailureRate: 0.02,    // 2%
        mttrSeconds: 1800,          // 30분
      });
      expect(result).toBe(DORALevel.Elite);
    });

    it('High 등급 - 주 1회 배포, 12시간 리드타임', () => {
      const result = classifier.classify({
        deploymentFrequency: 0.2,   // 주 1.4회
        leadTimeSeconds: 43200,     // 12시간
        changeFailureRate: 0.08,    // 8%
        mttrSeconds: 43200,         // 12시간
      });
      expect(result).toBe(DORALevel.High);
    });

    it('Medium 등급 - 월 2회 배포', () => {
      const result = classifier.classify({
        deploymentFrequency: 0.067, // 월 2회
        leadTimeSeconds: 259200,    // 3일
        changeFailureRate: 0.12,    // 12%
        mttrSeconds: 259200,        // 3일
      });
      expect(result).toBe(DORALevel.Medium);
    });

    it('Low 등급 - 월 1회 미만 배포', () => {
      const result = classifier.classify({
        deploymentFrequency: 0.01,  // 거의 안 함
        leadTimeSeconds: 1209600,   // 2주
        changeFailureRate: 0.25,    // 25%
        mttrSeconds: 1209600,       // 2주
      });
      expect(result).toBe(DORALevel.Low);
    });

    it('병목 원리 - 하나의 지표가 낮으면 전체 등급 하락', () => {
      const result = classifier.classify({
        deploymentFrequency: 5,     // Elite
        leadTimeSeconds: 1800,      // Elite
        changeFailureRate: 0.02,    // Elite
        mttrSeconds: 1209600,       // Low (2주)
      });
      expect(result).toBe(DORALevel.Low);
    });
  });

  describe('classifyDetailed', () => {
    it('상세 분류 - 병목 지표 식별', () => {
      const result = classifier.classifyDetailed({
        deploymentFrequency: 5,     // Elite
        leadTimeSeconds: 1800,      // Elite
        changeFailureRate: 0.12,    // Medium
        mttrSeconds: 3600,          // Elite
      });

      expect(result.overall).toBe(DORALevel.Medium);
      expect(result.breakdown.deploymentFrequency).toBe(DORALevel.Elite);
      expect(result.breakdown.changeFailureRate).toBe(DORALevel.Medium);
      expect(result.bottleneck).toBe('changeFailureRate');
    });

    it('모든 지표 동일 등급', () => {
      const result = classifier.classifyDetailed({
        deploymentFrequency: 5,
        leadTimeSeconds: 1800,
        changeFailureRate: 0.02,
        mttrSeconds: 1800,
      });

      expect(result.overall).toBe(DORALevel.Elite);
      expect(Object.values(result.breakdown).every(v => v === DORALevel.Elite)).toBe(true);
    });
  });
});
