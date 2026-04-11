/**
 * DORA 보고서 생성기 테스트
 * Design Ref: MTU-N251 §3.2, §3.8
 * Plan SC: FR-N251.9
 */

import { ReportGenerator } from '../src/report-generator';
import { TrendAnalyzer } from '../src/trend-analyzer';

describe('ReportGenerator', () => {
  let trendAnalyzer: TrendAnalyzer;
  let reportGenerator: ReportGenerator;

  beforeEach(() => {
    trendAnalyzer = new TrendAnalyzer();
    reportGenerator = new ReportGenerator(trendAnalyzer);
  });

  describe('generateWeeklyReport', () => {
    it('스냅샷 없이도 보고서 생성', () => {
      const report = reportGenerator.generateWeeklyReport();

      expect(report).toContain('# DORA Four Keys 주간 보고서');
      expect(report).toContain('## 1. Four Keys 종합 요약');
      expect(report).toContain('## 2. DORA 종합 등급');
      expect(report).toContain('CSAP 참조');
      expect(report).toContain('D-06');
    });

    it('스냅샷이 있으면 실제 데이터 반영', () => {
      trendAnalyzer.recordSnapshot({
        deploymentFrequency: 5,
        leadTimeSeconds: 1800,
        changeFailureRate: 0.02,
        mttrSeconds: 1800,
      });

      const report = reportGenerator.generateWeeklyReport();

      expect(report).toContain('Elite');
      expect(report).toContain('배포 빈도');
    });

    it('팀 필터 설정 시 대상 팀 표시', () => {
      const report = reportGenerator.generateWeeklyReport({
        team: 'platform',
      });

      expect(report).toContain('platform');
    });

    it('제목 접두사 설정', () => {
      const report = reportGenerator.generateWeeklyReport({
        titlePrefix: '공공기관 SaaS',
      });

      expect(report).toContain('공공기관 SaaS DORA Four Keys 보고서');
    });

    it('CSAP 참조 항목 커스텀', () => {
      const report = reportGenerator.generateWeeklyReport({
        csapRefs: ['D-06', 'D-12', 'D-08'],
      });

      expect(report).toContain('D-06, D-12, D-08');
    });
  });

  describe('generateMonthlyReport', () => {
    it('월간 보고서 생성', () => {
      trendAnalyzer.recordSnapshot({
        deploymentFrequency: 0.5,
        leadTimeSeconds: 43200,
        changeFailureRate: 0.08,
        mttrSeconds: 7200,
      });

      const report = reportGenerator.generateMonthlyReport();

      expect(report).toContain('월간');
      expect(report).toContain('최근 30일');
    });
  });

  describe('generateAuditEvidence', () => {
    it('감사 증빙 형식 반환', () => {
      trendAnalyzer.recordSnapshot({
        deploymentFrequency: 3,
        leadTimeSeconds: 3600,
        changeFailureRate: 0.04,
        mttrSeconds: 1800,
      });

      const evidence = reportGenerator.generateAuditEvidence();

      expect(evidence.documentId).toMatch(/^DORA-EVIDENCE-\d{4}-W\d+$/);
      expect(evidence.csapRef).toContain('D-06');
      expect(evidence.csapRef).toContain('D-12');
      expect(evidence.generatedAt).toBeTruthy();
      expect(evidence.content).toContain('DORA Four Keys');
    });

    it('커스텀 CSAP 참조', () => {
      const evidence = reportGenerator.generateAuditEvidence({
        csapRefs: ['D-06'],
      });

      expect(evidence.csapRef).toEqual(['D-06']);
    });
  });

  describe('보고서 내용 품질', () => {
    it('Elite 등급 시 PASS 표시', () => {
      trendAnalyzer.recordSnapshot({
        deploymentFrequency: 5,
        leadTimeSeconds: 1800,
        changeFailureRate: 0.02,
        mttrSeconds: 1800,
      });

      const report = reportGenerator.generateWeeklyReport();

      expect(report).toContain('PASS');
    });

    it('Low 등급 시 REVIEW 표시', () => {
      trendAnalyzer.recordSnapshot({
        deploymentFrequency: 0.01,
        leadTimeSeconds: 604800,
        changeFailureRate: 0.3,
        mttrSeconds: 604800,
      });

      const report = reportGenerator.generateWeeklyReport();

      expect(report).toContain('REVIEW');
    });

    it('보고서에 자동 생성 표시', () => {
      const report = reportGenerator.generateWeeklyReport();

      expect(report).toContain('DORA Exporter v2에 의해 자동 생성');
    });

    it('보고서에 시간 형식이 가독성 있게 표시', () => {
      trendAnalyzer.recordSnapshot({
        deploymentFrequency: 5,
        leadTimeSeconds: 7200, // 2시간
        changeFailureRate: 0.02,
        mttrSeconds: 300, // 5분
      });

      const report = reportGenerator.generateWeeklyReport();

      // 시간 형식 확인 (초/분/시간/일)
      expect(report).toMatch(/시간|분|초|일/);
    });
  });
});
