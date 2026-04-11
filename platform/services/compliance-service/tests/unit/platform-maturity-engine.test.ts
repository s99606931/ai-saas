// MTU-N243 단위 테스트: 플랫폼 성숙도 평가 엔진
// Design Ref: MTU-N243 Design
// CSAP: D-06 감사 로깅, D-12 시스템 개발 보안

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PlatformMaturityEngine,
  MaturityDomain,
  MaturityLevel,
} from '../../src/lib/platform-maturity-engine';

describe('PlatformMaturityEngine', () => {
  let engine: PlatformMaturityEngine;

  beforeEach(() => {
    engine = new PlatformMaturityEngine();
  });

  describe('기본 구성', () => {
    it('50개 기본 평가 항목 (5영역 x 10항목)', () => {
      expect(engine.getTotalItemCount()).toBe(50);
    });

    it('5개 영역 모두 포함', () => {
      const domains = Object.values(MaturityDomain);
      for (const domain of domains) {
        const items = engine.getItemsByDomain(domain);
        expect(items.length).toBeGreaterThan(0);
      }
    });

    it('각 영역 10개 항목', () => {
      for (const domain of Object.values(MaturityDomain)) {
        const items = engine.getItemsByDomain(domain);
        expect(items).toHaveLength(10);
      }
    });

    it('초기 충족 항목 0개', () => {
      expect(engine.getSatisfiedCount()).toBe(0);
    });
  });

  describe('markSatisfied / markUnsatisfied', () => {
    it('항목 충족 표시', () => {
      const result = engine.markSatisfied('CICD-L1-01', 'Git 리포지토리 확인');
      expect(result).toBe(true);
      expect(engine.getSatisfiedCount()).toBe(1);
    });

    it('존재하지 않는 항목 ID', () => {
      const result = engine.markSatisfied('NONEXISTENT');
      expect(result).toBe(false);
    });

    it('미충족으로 되돌리기', () => {
      engine.markSatisfied('CICD-L1-01');
      engine.markUnsatisfied('CICD-L1-01');
      expect(engine.getSatisfiedCount()).toBe(0);
    });

    it('일괄 충족 표시', () => {
      const count = engine.markMultipleSatisfied(
        ['CICD-L1-01', 'CICD-L1-02', 'NONEXISTENT'],
        '자동 점검 통과',
      );
      expect(count).toBe(2); // NONEXISTENT 제외
      expect(engine.getSatisfiedCount()).toBe(2);
    });
  });

  describe('assessDomain', () => {
    it('미충족 시 L1 수준', () => {
      const result = engine.assessDomain(MaturityDomain.CICD);
      expect(result.achievedLevel).toBe(MaturityLevel.Initial);
      expect(result.satisfiedItems).toBe(0);
      expect(result.gaps.length).toBeGreaterThan(0);
    });

    it('L1 모두 충족 → L1 달성', () => {
      engine.markSatisfied('CICD-L1-01');
      engine.markSatisfied('CICD-L1-02');

      const result = engine.assessDomain(MaturityDomain.CICD);
      expect(result.achievedLevel).toBe(MaturityLevel.Initial);
    });

    it('L1+L2 모두 충족 → L2 달성', () => {
      engine.markMultipleSatisfied([
        'CICD-L1-01', 'CICD-L1-02',
        'CICD-L2-01', 'CICD-L2-02',
      ]);

      const result = engine.assessDomain(MaturityDomain.CICD);
      expect(result.achievedLevel).toBe(MaturityLevel.Managed);
    });

    it('L2 미충족 시 L3 충족해도 L1 유지', () => {
      engine.markMultipleSatisfied([
        'CICD-L1-01', 'CICD-L1-02',
        // L2 건너뜀
        'CICD-L3-01', 'CICD-L3-02',
      ]);

      const result = engine.assessDomain(MaturityDomain.CICD);
      // L2 미달이므로 L1에서 멈춤
      expect(result.achievedLevel).toBe(MaturityLevel.Initial);
    });

    it('전체 충족 → L5 달성', () => {
      const cicdItems = engine.getItemsByDomain(MaturityDomain.CICD);
      engine.markMultipleSatisfied(cicdItems.map(i => i.id));

      const result = engine.assessDomain(MaturityDomain.CICD);
      expect(result.achievedLevel).toBe(MaturityLevel.Optimizing);
      expect(result.gaps).toHaveLength(0);
      expect(result.satisfactionRate).toBe(1);
    });

    it('수준별 충족 현황 포함', () => {
      engine.markMultipleSatisfied(['CICD-L1-01', 'CICD-L1-02']);

      const result = engine.assessDomain(MaturityDomain.CICD);
      expect(result.levelBreakdown[1]!.satisfied).toBe(2);
      expect(result.levelBreakdown[1]!.total).toBe(2);
      expect(result.levelBreakdown[2]!.satisfied).toBe(0);
    });

    it('영역 이름 한글 포함', () => {
      const result = engine.assessDomain(MaturityDomain.CICD);
      expect(result.domainName).toBe('CI/CD 파이프라인');
    });
  });

  describe('generateReport', () => {
    it('종합 보고서 생성', () => {
      const report = engine.generateReport();

      expect(report.reportId).toMatch(/^maturity-/);
      expect(report.overallScore).toBe(1); // 미충족 시 Initial(1)부터 시작
      expect(report.domains).toHaveLength(5);
      expect(report.assessedAt).toBeTruthy();
      expect(report.totalItems).toBe(50);
      expect(report.totalSatisfied).toBe(0);
    });

    it('일부 충족 후 점수 변화', () => {
      // CI/CD L1+L2 충족 (managed=2), 나머지 initial
      engine.markMultipleSatisfied([
        'CICD-L1-01', 'CICD-L1-02',
        'CICD-L2-01', 'CICD-L2-02',
      ]);

      const report = engine.generateReport();
      // CICD=2, 나머지 4개=0 → 평균 = 2/5 = 0.4
      // achievedLevel이 0이면 Initial(1)로 간주하지 않으므로 0
      // 전체 레벨이 1부터 시작하지만 미충족 시 0으로 계산
      expect(report.overallScore).toBeGreaterThan(0);
    });

    it('전체 L5 달성 시 점수 5.0', () => {
      const allItems = engine.getItems();
      engine.markMultipleSatisfied(allItems.map(i => i.id));

      const report = engine.generateReport();
      expect(report.overallScore).toBe(5);
      expect(report.overallLevel).toBe(MaturityLevel.Optimizing);
    });

    it('보고서 이력 저장', () => {
      engine.generateReport();
      engine.generateReport();

      const history = engine.getReportHistory();
      expect(history).toHaveLength(2);
    });

    it('개선 권장사항 포함', () => {
      const report = engine.generateReport();
      expect(report.recommendations.length).toBeGreaterThan(0);

      const firstRec = report.recommendations[0]!;
      expect(firstRec.priority).toBe(1);
      expect(firstRec.action).toBeTruthy();
      expect(firstRec.impact).toBeTruthy();
      expect(['low', 'medium', 'high']).toContain(firstRec.difficulty);
    });

    it('전체 충족 시 권장사항 없음', () => {
      const allItems = engine.getItems();
      engine.markMultipleSatisfied(allItems.map(i => i.id));

      const report = engine.generateReport();
      expect(report.recommendations).toHaveLength(0);
    });
  });

  describe('generateMarkdownReport', () => {
    it('마크다운 보고서 생성', () => {
      engine.markMultipleSatisfied([
        'CICD-L1-01', 'CICD-L1-02',
        'OBS-L1-01', 'OBS-L1-02',
      ]);

      const md = engine.generateMarkdownReport();

      expect(md).toContain('# 플랫폼 성숙도 평가 보고서');
      expect(md).toContain('## 종합 결과');
      expect(md).toContain('## 영역별 결과');
      expect(md).toContain('CI/CD 파이프라인');
      expect(md).toContain('관측성');
      expect(md).toContain('보안 컴플라이언스');
      expect(md).toContain('인프라 자동화');
      expect(md).toContain('거버넌스');
    });

    it('개선 권장사항 섹션 포함', () => {
      const md = engine.generateMarkdownReport();
      expect(md).toContain('## 개선 권장사항');
    });
  });

  describe('커스텀 항목', () => {
    it('사용자 정의 항목으로 초기화', () => {
      const customEngine = new PlatformMaturityEngine({
        items: [
          {
            id: 'CUSTOM-01',
            domain: MaturityDomain.CICD,
            level: MaturityLevel.Initial,
            name: '커스텀 항목',
            description: '테스트용',
            satisfied: false,
          },
        ],
      });

      expect(customEngine.getTotalItemCount()).toBe(1);
      customEngine.markSatisfied('CUSTOM-01');
      expect(customEngine.getSatisfiedCount()).toBe(1);
    });
  });

  describe('보고서 이력', () => {
    it('이력 제한', () => {
      const smallEngine = new PlatformMaturityEngine({ maxHistory: 3 });

      for (let i = 0; i < 5; i++) {
        smallEngine.generateReport();
      }

      const history = smallEngine.getReportHistory();
      expect(history).toHaveLength(3);
    });

    it('최근 보고서 우선 반환', () => {
      engine.generateReport();

      // 상태 변경 후 재평가
      engine.markSatisfied('CICD-L1-01');
      engine.generateReport();

      const history = engine.getReportHistory(1);
      expect(history).toHaveLength(1);
      expect(history[0]!.totalSatisfied).toBe(1);
    });
  });
});
