import { describe, it, expect, beforeEach } from 'vitest';
import { GrievanceSentimentAnalyzer, type GrievanceRecord } from '../grievance-sentiment-analyzer';

describe('GrievanceSentimentAnalyzer', () => {
  let analyzer: GrievanceSentimentAnalyzer;

  const makeRecord = (id: string, content: string, overrides?: Partial<GrievanceRecord>): GrievanceRecord => ({
    id,
    tenantId: 'tenant-1',
    submittedAt: new Date().toISOString(),
    content,
    category: '민원',
    ...overrides,
  });

  beforeEach(() => {
    analyzer = new GrievanceSentimentAnalyzer();
  });

  // FR-R167.1 민원 등록
  it('FR-R167.1 민원 등록 후 감사 로그 생성', () => {
    analyzer.register(makeRecord('g1', '서비스 만족합니다'));
    const log = analyzer.getAuditLog();
    expect(log.some((e) => e.action === 'GRIEVANCE_REGISTERED')).toBe(true);
    expect(log[0]!.grievanceId).toBe('g1');
  });

  // FR-R167.2 감정 분석
  it('FR-R167.2 긍정 감정 분류', () => {
    analyzer.register(makeRecord('g1', '직원이 친절하고 서비스가 훌륭합니다. 감사합니다'));
    const result = analyzer.analyze('g1');
    expect(result.sentiment).toBe('POSITIVE');
    expect(result.urgencyFlag).toBe(false);
  });

  it('FR-R167.2 부정 감정 분류', () => {
    analyzer.register(makeRecord('g2', '서비스 지연으로 불만이 있습니다. 오류가 많고 불편합니다'));
    const result = analyzer.analyze('g2');
    expect(result.sentiment).toBe('NEGATIVE');
  });

  it('FR-R167.2 긴급 감정 분류', () => {
    analyzer.register(makeRecord('g3', '긴급 상황입니다. 위험하며 즉시 법적 조치가 필요합니다. 불만이 있습니다'));
    const result = analyzer.analyze('g3');
    expect(result.sentiment).toBe('URGENT');
    expect(result.urgencyFlag).toBe(true);
  });

  it('FR-R167.2 중립 감정', () => {
    analyzer.register(makeRecord('g4', '문의 사항이 있습니다. 처리해 주세요'));
    const result = analyzer.analyze('g4');
    expect(result.sentiment).toBe('NEUTRAL');
  });

  it('FR-R167.2 미등록 민원 분석 시 에러', () => {
    expect(() => analyzer.analyze('unknown')).toThrow();
  });

  it('FR-R167.2 분석 결과 score 범위 0~1', () => {
    analyzer.register(makeRecord('g5', '불만 불편 오류 지연 문제 실망 화남'));
    const result = analyzer.analyze('g5');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  // FR-R167.3 긴급 민원 목록
  it('FR-R167.3 긴급 민원 필터링', () => {
    analyzer.register(makeRecord('g1', '일반 문의'));
    analyzer.register(makeRecord('g2', '긴급 위험 즉시 조치 필요'));
    analyzer.analyze('g1');
    analyzer.analyze('g2');
    const urgent = analyzer.getUrgent();
    expect(urgent.length).toBe(1);
    expect(urgent[0]!.grievanceId).toBe('g2');
  });

  // FR-R167.4 트렌드 리포트
  it('FR-R167.4 테넌트 트렌드 리포트', () => {
    const r1 = makeRecord('g1', '감사합니다 만족', { tenantId: 'A' });
    const r2 = makeRecord('g2', '불만 불편', { tenantId: 'A' });
    const r3 = makeRecord('g3', '일반', { tenantId: 'B' });
    analyzer.register(r1);
    analyzer.register(r2);
    analyzer.register(r3);
    analyzer.analyze('g1');
    analyzer.analyze('g2');
    analyzer.analyze('g3');
    const trend = analyzer.getTrend('A', '2026-Q1');
    expect(trend.total).toBe(2);
    expect(trend.period).toBe('2026-Q1');
  });

  it('FR-R167.4 카테고리별 집계', () => {
    analyzer.register(makeRecord('g1', '내용', { category: 'IT민원', tenantId: 'T' }));
    analyzer.register(makeRecord('g2', '내용', { category: 'IT민원', tenantId: 'T' }));
    analyzer.register(makeRecord('g3', '내용', { category: '일반민원', tenantId: 'T' }));
    const trend = analyzer.getTrend('T', '2026');
    expect(trend.topCategories[0]!.category).toBe('IT민원');
    expect(trend.topCategories[0]!.count).toBe(2);
  });

  // FR-R167.5 감사 로그 (CSAP D-06)
  it('FR-R167.5 분석 후 감사 로그 기록', () => {
    analyzer.register(makeRecord('g1', '테스트 내용'));
    analyzer.analyze('g1');
    const log = analyzer.getAuditLog();
    expect(log.some((e) => e.action === 'SENTIMENT_ANALYZED')).toBe(true);
  });
});
