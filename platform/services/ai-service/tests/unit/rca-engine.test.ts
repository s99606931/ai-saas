// MTU-N252 단위 테스트: AIOps RCA 엔진
// Design Ref: MTU-N252 Design §2.2
// Plan SC: FR-N252.1, FR-N252.2, FR-N252.4, FR-N252.5
// CSAP: D-06 침해사고 관리

import { describe, it, expect, beforeEach } from 'vitest';

import {
  RCAEngine,
  AnomalyType,
  IncidentSeverity,
  RCACategory,
  Incident,
} from '../../src/lib/rca-engine';

function createIncident(overrides?: Partial<Incident>): Incident {
  return {
    id: `inc-${Math.random().toString(36).slice(2, 10)}`,
    service: 'api-gateway',
    namespace: 'production',
    symptoms: [AnomalyType.HighCPU, AnomalyType.HighLatency],
    severity: IncidentSeverity.High,
    startedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('RCAEngine', () => {
  let engine: RCAEngine;

  beforeEach(() => {
    engine = new RCAEngine();
  });

  describe('패턴 정의', () => {
    it('10개 이상의 RCA 패턴 보유', () => {
      expect(engine.getPatternCount()).toBeGreaterThanOrEqual(10);
    });
  });

  describe('analyze', () => {
    it('CPU + 지연시간 → CPU 병목 패턴 매칭', () => {
      const incident = createIncident({
        symptoms: [AnomalyType.HighCPU, AnomalyType.HighLatency],
      });

      const result = engine.analyze(incident);

      expect(result.candidates.length).toBeGreaterThan(0);
      const topCandidate = result.candidates[0];
      expect(topCandidate.cause).toContain('CPU');
      expect(topCandidate.category).toBe(RCACategory.Resource);
      expect(topCandidate.confidence).toBeGreaterThan(0.5);
    });

    it('OOM Kill + 메모리 → 메모리 누수 패턴 매칭', () => {
      const incident = createIncident({
        symptoms: [AnomalyType.OOMKill, AnomalyType.HighMemory],
      });

      const result = engine.analyze(incident);

      const memoryCandidate = result.candidates.find(c => c.cause.includes('메모리'));
      expect(memoryCandidate).toBeTruthy();
      expect(memoryCandidate!.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('에러율 + 정상리소스 → 업스트림 의존성 장애', () => {
      const incident = createIncident({
        symptoms: [AnomalyType.HighErrorRate, AnomalyType.NormalResources],
      });

      const result = engine.analyze(incident);

      const depCandidate = result.candidates.find(c => c.category === RCACategory.Dependency);
      expect(depCandidate).toBeTruthy();
    });

    it('파드 재시작 + CrashLoop → 애플리케이션 크래시', () => {
      const incident = createIncident({
        symptoms: [AnomalyType.PodRestart, AnomalyType.CrashLoop],
      });

      const result = engine.analyze(incident);

      const appCandidate = result.candidates.find(c =>
        c.cause.includes('크래시') || c.cause.includes('재시작'),
      );
      expect(appCandidate).toBeTruthy();
      expect(appCandidate!.confidence).toBeGreaterThanOrEqual(0.9);
    });

    it('노드 NotReady + 파드 Pending → 노드 장애', () => {
      const incident = createIncident({
        symptoms: [AnomalyType.NodeNotReady, AnomalyType.PodPending],
      });

      const result = engine.analyze(incident);

      const infraCandidate = result.candidates.find(c => c.category === RCACategory.Infrastructure);
      expect(infraCandidate).toBeTruthy();
    });

    it('에러율 + 최근배포 → 배포 문제', () => {
      const incident = createIncident({
        symptoms: [AnomalyType.HighErrorRate, AnomalyType.RecentDeploy],
      });

      const result = engine.analyze(incident);

      const deployCandidate = result.candidates.find(c => c.cause.includes('배포'));
      expect(deployCandidate).toBeTruthy();
      expect(deployCandidate!.recommendation).toContain('롤백');
    });

    it('PVC Pending + 파드 Pending → 스토리지 부족', () => {
      const incident = createIncident({
        symptoms: [AnomalyType.PVCPending, AnomalyType.PodPending],
      });

      const result = engine.analyze(incident);

      const storageCandidate = result.candidates.find(c => c.category === RCACategory.Storage);
      expect(storageCandidate).toBeTruthy();
    });

    it('DNS 지연 + 서비스 지연 → CoreDNS 병목', () => {
      const incident = createIncident({
        symptoms: [AnomalyType.DNSLatency, AnomalyType.HighLatency],
      });

      const result = engine.analyze(incident);

      const dnsCandidate = result.candidates.find(c => c.cause.includes('DNS'));
      expect(dnsCandidate).toBeTruthy();
    });

    it('매칭 패턴 없으면 빈 후보 목록', () => {
      const incident = createIncident({
        symptoms: [], // 증상 없음
      });

      const result = engine.analyze(incident);

      expect(result.candidates.length).toBe(0);
    });

    it('복수 패턴 매칭 시 확률 순 정렬', () => {
      const incident = createIncident({
        symptoms: [
          AnomalyType.HighCPU,
          AnomalyType.HighLatency,
          AnomalyType.HighMemory,
          AnomalyType.PodRestart,
        ],
      });

      const result = engine.analyze(incident);

      expect(result.candidates.length).toBeGreaterThan(1);
      // 확률 내림차순 정렬 확인
      for (let i = 1; i < result.candidates.length; i++) {
        expect(result.candidates[i - 1].confidence).toBeGreaterThanOrEqual(
          result.candidates[i].confidence,
        );
      }
    });

    it('분석 시간 기록', () => {
      const incident = createIncident();
      const result = engine.analyze(incident);

      expect(result.analysisTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.analyzedAt).toBeTruthy();
    });
  });

  describe('상관관계 분석', () => {
    it('관련 증상 간 상관관계 점수 계산', () => {
      const incident = createIncident({
        symptoms: [AnomalyType.HighCPU, AnomalyType.HighLatency],
      });

      const result = engine.analyze(incident);

      expect(result.correlationScores.length).toBeGreaterThan(0);
      expect(result.correlationScores[0].correlation).toBeGreaterThan(0.5);
    });

    it('상관관계 없는 증상은 점수 미생성', () => {
      const incident = createIncident({
        symptoms: [AnomalyType.PVCPending, AnomalyType.DNSLatency],
      });

      const result = engine.analyze(incident);

      // PVCPending과 DNSLatency 간에는 사전 정의된 상관관계 없음
      expect(result.correlationScores.length).toBe(0);
    });
  });

  describe('formatAlertAnnotation', () => {
    it('RCA 후보가 있으면 알림 주석 생성', () => {
      const incident = createIncident({
        symptoms: [AnomalyType.HighCPU, AnomalyType.HighLatency],
      });
      const result = engine.analyze(incident);
      const annotation = engine.formatAlertAnnotation(result);

      expect(annotation).toContain('[RCA]');
      expect(annotation).toContain('가장 유력한 원인');
      expect(annotation).toContain('권고 조치');
    });

    it('RCA 후보 없으면 수동 분석 필요 메시지', () => {
      const incident = createIncident({ symptoms: [] });
      const result = engine.analyze(incident);
      const annotation = engine.formatAlertAnnotation(result);

      expect(annotation).toContain('수동 분석 필요');
    });
  });

  describe('generateReport', () => {
    it('RCA 보고서 Markdown 생성', () => {
      const incident = createIncident({
        id: 'INC-2026-001',
        symptoms: [AnomalyType.OOMKill, AnomalyType.HighMemory],
      });
      const result = engine.analyze(incident);
      const report = engine.generateReport(result);

      expect(report.documentId).toContain('INC-2026-001');
      expect(report.csapRef).toContain('D-06');
      expect(report.content).toContain('# AIOps RCA 분석 보고서');
      expect(report.content).toContain('인시던트 타임라인');
      expect(report.content).toContain('감지된 이상 징후');
      expect(report.content).toContain('RCA 후보');
      expect(report.content).toContain('권고 조치');
    });

    it('보고서에 CSAP D-06 참조 포함', () => {
      const incident = createIncident();
      const result = engine.analyze(incident);
      const report = engine.generateReport(result);

      expect(report.content).toContain('CSAP 참조');
      expect(report.content).toContain('D-06');
    });

    it('매칭 패턴 없을 때 수동 분석 안내', () => {
      const incident = createIncident({ symptoms: [] });
      const result = engine.analyze(incident);
      const report = engine.generateReport(result);

      expect(report.content).toContain('수동 분석');
    });
  });

  describe('getHistory', () => {
    it('분석 히스토리 저장 및 조회', () => {
      engine.analyze(createIncident({ id: 'inc-1' }));
      engine.analyze(createIncident({ id: 'inc-2' }));
      engine.analyze(createIncident({ id: 'inc-3' }));

      const history = engine.getHistory();
      expect(history.length).toBe(3);
    });

    it('limit 파라미터로 조회 제한', () => {
      for (let i = 0; i < 10; i++) {
        engine.analyze(createIncident());
      }

      const limited = engine.getHistory(5);
      expect(limited.length).toBe(5);
    });
  });

  describe('전체 패턴 카테고리 커버리지', () => {
    it('모든 RCA 카테고리 커버', () => {
      const allCategories = [
        RCACategory.Resource,
        RCACategory.Application,
        RCACategory.Infrastructure,
        RCACategory.Network,
        RCACategory.Storage,
        RCACategory.Dependency,
      ];

      // 각 카테고리에 해당하는 증상 조합으로 테스트
      const categoryTests: Record<RCACategory, AnomalyType[]> = {
        [RCACategory.Resource]: [AnomalyType.HighCPU, AnomalyType.HighLatency],
        [RCACategory.Application]: [AnomalyType.PodRestart, AnomalyType.CrashLoop],
        [RCACategory.Infrastructure]: [AnomalyType.NodeNotReady, AnomalyType.PodPending],
        [RCACategory.Network]: [AnomalyType.NetworkError, AnomalyType.HighLatency],
        [RCACategory.Storage]: [AnomalyType.PVCPending, AnomalyType.PodPending],
        [RCACategory.Dependency]: [AnomalyType.HighErrorRate, AnomalyType.NormalResources],
      };

      for (const category of allCategories) {
        const incident = createIncident({ symptoms: categoryTests[category] });
        const result = engine.analyze(incident);
        const matching = result.candidates.find(c => c.category === category);
        expect(matching).toBeTruthy();
      }
    });
  });
});
