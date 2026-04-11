/**
 * DORA 추세 분석기 테스트
 * Design Ref: MTU-N251 §3.1
 * Plan SC: FR-N251.6, FR-N251.9
 */

import { TrendAnalyzer } from '../src/trend-analyzer';
import { DORALevel } from '../src/classifier';

describe('TrendAnalyzer', () => {
  let analyzer: TrendAnalyzer;

  beforeEach(() => {
    analyzer = new TrendAnalyzer();
  });

  describe('recordSnapshot', () => {
    it('스냅샷 기록 및 등급 자동 계산', () => {
      const snapshot = analyzer.recordSnapshot({
        deploymentFrequency: 5,
        leadTimeSeconds: 1800,
        changeFailureRate: 0.02,
        mttrSeconds: 1800,
      });

      expect(snapshot.level).toBe(DORALevel.Elite);
      expect(snapshot.deploymentFrequency).toBe(5);
      expect(snapshot.timestamp).toBeTruthy();
    });

    it('스냅샷 수 추적', () => {
      analyzer.recordSnapshot({
        deploymentFrequency: 1,
        leadTimeSeconds: 3600,
        changeFailureRate: 0.05,
        mttrSeconds: 3600,
      });

      expect(analyzer.getSnapshotCount()).toBe(1);

      analyzer.recordSnapshot({
        deploymentFrequency: 2,
        leadTimeSeconds: 1800,
        changeFailureRate: 0.03,
        mttrSeconds: 1800,
      });

      expect(analyzer.getSnapshotCount()).toBe(2);
    });

    it('최대 스냅샷 수 초과 시 오래된 것 제거', () => {
      // 366개 스냅샷을 추가하면 maxSnapshots(365) 초과
      for (let i = 0; i < 370; i++) {
        analyzer.recordSnapshot({
          deploymentFrequency: i,
          leadTimeSeconds: 3600,
          changeFailureRate: 0.05,
          mttrSeconds: 3600,
        });
      }

      expect(analyzer.getSnapshotCount()).toBe(365);
    });
  });

  describe('calculateImprovement', () => {
    it('개선된 경우 양수 종합 점수', () => {
      const current = {
        timestamp: new Date().toISOString(),
        deploymentFrequency: 5,
        leadTimeSeconds: 1800,
        changeFailureRate: 0.02,
        mttrSeconds: 1800,
        level: DORALevel.Elite,
      };

      const previous = {
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        deploymentFrequency: 2,
        leadTimeSeconds: 3600,
        changeFailureRate: 0.05,
        mttrSeconds: 3600,
        level: DORALevel.High,
      };

      const improvement = analyzer.calculateImprovement(current, previous);

      // 배포 빈도 증가 = 양수
      expect(improvement.deploymentFrequencyChange).toBeGreaterThan(0);
      // 리드타임 감소 = 음수
      expect(improvement.leadTimeChange).toBeLessThan(0);
      // CFR 감소 = 음수
      expect(improvement.changeFailureRateChange).toBeLessThan(0);
      // MTTR 감소 = 음수
      expect(improvement.mttrChange).toBeLessThan(0);
      // 등급 상승
      expect(improvement.levelChange).toBeGreaterThan(0);
      // 종합 점수 50 이상 (개선)
      expect(improvement.overallScore).toBeGreaterThan(50);
    });

    it('악화된 경우 낮은 종합 점수', () => {
      const current = {
        timestamp: new Date().toISOString(),
        deploymentFrequency: 0.01,
        leadTimeSeconds: 604800,
        changeFailureRate: 0.3,
        mttrSeconds: 604800,
        level: DORALevel.Low,
      };

      const previous = {
        timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        deploymentFrequency: 5,
        leadTimeSeconds: 1800,
        changeFailureRate: 0.02,
        mttrSeconds: 1800,
        level: DORALevel.Elite,
      };

      const improvement = analyzer.calculateImprovement(current, previous);

      expect(improvement.deploymentFrequencyChange).toBeLessThan(0);
      expect(improvement.leadTimeChange).toBeGreaterThan(0);
      expect(improvement.levelChange).toBeLessThan(0);
      expect(improvement.overallScore).toBeLessThan(50);
    });

    it('변화 없으면 종합 점수 50 (중립)', () => {
      const snapshot = {
        timestamp: new Date().toISOString(),
        deploymentFrequency: 3,
        leadTimeSeconds: 3600,
        changeFailureRate: 0.05,
        mttrSeconds: 3600,
        level: DORALevel.Elite,
      };

      const improvement = analyzer.calculateImprovement(snapshot, snapshot);

      expect(improvement.deploymentFrequencyChange).toBe(0);
      expect(improvement.leadTimeChange).toBe(0);
      expect(improvement.overallScore).toBe(50);
    });

    it('이전 값이 0인 경우 변화율 0', () => {
      const current = {
        timestamp: new Date().toISOString(),
        deploymentFrequency: 5,
        leadTimeSeconds: 1800,
        changeFailureRate: 0.02,
        mttrSeconds: 1800,
        level: DORALevel.Elite,
      };

      const previous = {
        timestamp: new Date().toISOString(),
        deploymentFrequency: 0,
        leadTimeSeconds: 0,
        changeFailureRate: 0,
        mttrSeconds: 0,
        level: DORALevel.Low,
      };

      const improvement = analyzer.calculateImprovement(current, previous);

      expect(improvement.deploymentFrequencyChange).toBe(0);
      expect(improvement.leadTimeChange).toBe(0);
    });
  });

  describe('analyzeWeekly', () => {
    it('스냅샷 없으면 빈 보고서', () => {
      const report = analyzer.analyzeWeekly();

      expect(report.period).toBe('weekly');
      expect(report.current.level).toBe(DORALevel.Low);
      expect(report.previous).toBeNull();
      expect(report.improvement).toBeNull();
    });

    it('스냅샷 있으면 정상 분석', () => {
      analyzer.recordSnapshot({
        deploymentFrequency: 5,
        leadTimeSeconds: 1800,
        changeFailureRate: 0.02,
        mttrSeconds: 1800,
      });

      const report = analyzer.analyzeWeekly();

      expect(report.period).toBe('weekly');
      expect(report.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeMonthly', () => {
    it('월간 분석 기본 동작', () => {
      analyzer.recordSnapshot({
        deploymentFrequency: 0.2,
        leadTimeSeconds: 43200,
        changeFailureRate: 0.08,
        mttrSeconds: 43200,
      });

      const report = analyzer.analyzeMonthly();

      expect(report.period).toBe('monthly');
    });
  });

  describe('getRecentSnapshots', () => {
    it('최근 N개 스냅샷 반환', () => {
      for (let i = 0; i < 10; i++) {
        analyzer.recordSnapshot({
          deploymentFrequency: i + 1,
          leadTimeSeconds: 3600,
          changeFailureRate: 0.05,
          mttrSeconds: 3600,
        });
      }

      const recent = analyzer.getRecentSnapshots(3);
      expect(recent.length).toBe(3);
      expect(recent[2].deploymentFrequency).toBe(10);
    });
  });

  describe('recommendations', () => {
    it('낮은 배포 빈도 시 권고사항 생성', () => {
      analyzer.recordSnapshot({
        deploymentFrequency: 0.01,
        leadTimeSeconds: 3600,
        changeFailureRate: 0.05,
        mttrSeconds: 3600,
      });

      const report = analyzer.analyzeWeekly();
      const dfRec = report.recommendations.find(r => r.includes('[DF]'));
      expect(dfRec).toBeTruthy();
    });

    it('높은 리드타임 시 권고사항 생성', () => {
      analyzer.recordSnapshot({
        deploymentFrequency: 5,
        leadTimeSeconds: 172800, // 2일
        changeFailureRate: 0.02,
        mttrSeconds: 1800,
      });

      const report = analyzer.analyzeWeekly();
      const ltRec = report.recommendations.find(r => r.includes('[LT]'));
      expect(ltRec).toBeTruthy();
    });

    it('높은 CFR 시 권고사항 생성', () => {
      analyzer.recordSnapshot({
        deploymentFrequency: 5,
        leadTimeSeconds: 1800,
        changeFailureRate: 0.25,
        mttrSeconds: 1800,
      });

      const report = analyzer.analyzeWeekly();
      const cfrRec = report.recommendations.find(r => r.includes('[CFR]'));
      expect(cfrRec).toBeTruthy();
    });

    it('높은 MTTR 시 권고사항 생성', () => {
      analyzer.recordSnapshot({
        deploymentFrequency: 5,
        leadTimeSeconds: 1800,
        changeFailureRate: 0.02,
        mttrSeconds: 7200, // 2시간
      });

      const report = analyzer.analyzeWeekly();
      const mttrRec = report.recommendations.find(r => r.includes('[MTTR]'));
      expect(mttrRec).toBeTruthy();
    });

    it('모든 지표 양호 시 양호 메시지', () => {
      analyzer.recordSnapshot({
        deploymentFrequency: 5,
        leadTimeSeconds: 1800,
        changeFailureRate: 0.02,
        mttrSeconds: 1800,
      });

      const report = analyzer.analyzeWeekly();
      const goodRec = report.recommendations.find(r => r.includes('[양호]'));
      expect(goodRec).toBeTruthy();
    });
  });
});
