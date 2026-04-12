import { describe, it, expect, beforeEach } from 'vitest';
import { LegalComplianceReviewerAI } from '../legal-compliance-reviewer-ai';

describe('LegalComplianceReviewerAI', () => {
  let reviewer: LegalComplianceReviewerAI;

  beforeEach(() => {
    reviewer = new LegalComplianceReviewerAI();
  });

  it('규정을 등록한다', () => {
    reviewer.registerRegulation('pipa', '개인정보보호법', [
      { id: 'art-1', requirement: '개인정보 수집 동의', mandatory: true },
    ]);
    expect(reviewer.getAuditLog().some(l => l.action === 'REGISTER_REGULATION')).toBe(true);
  });

  it('정책을 등록한다', () => {
    reviewer.registerPolicy('svc-policy', '서비스 정책', ['개인정보 수집 동의', '암호화 저장']);
    expect(reviewer.getAuditLog().some(l => l.action === 'REGISTER_POLICY')).toBe(true);
  });

  it('갭 분석: 필수 요건 미충족을 탐지한다', () => {
    reviewer.registerRegulation('pipa', '개인정보보호법', [
      { id: 'art-1', requirement: '개인정보 수집 동의', mandatory: true },
      { id: 'art-2', requirement: '암호화 저장', mandatory: true },
    ]);
    reviewer.registerPolicy('p1', '정책', ['암호화 저장']);
    const gap = reviewer.analyzeGaps('p1', 'pipa');
    expect(gap.gaps.length).toBe(1);
    expect(gap.mandatoryGaps).toBe(1);
  });

  it('모든 요건 충족 시 갭 없다', () => {
    reviewer.registerRegulation('pipa', '개인정보보호법', [
      { id: 'art-1', requirement: '동의', mandatory: true },
    ]);
    reviewer.registerPolicy('p1', '정책', ['동의']);
    const gap = reviewer.analyzeGaps('p1', 'pipa');
    expect(gap.gaps.length).toBe(0);
  });

  it('준수율을 올바르게 계산한다', () => {
    reviewer.registerRegulation('pipa', '개인정보보호법', [
      { id: 'art-1', requirement: '요건A', mandatory: true },
      { id: 'art-2', requirement: '요건B', mandatory: false },
      { id: 'art-3', requirement: '요건C', mandatory: false },
      { id: 'art-4', requirement: '요건D', mandatory: false },
    ]);
    reviewer.registerPolicy('p1', '정책', ['요건A', '요건B']);
    const report = reviewer.generateReport('p1');
    expect(report.complianceRate).toBe(50);
  });

  it('C등급 데이터 전송을 차단한다', () => {
    reviewer.registerRegulation('pipa', '법', []);
    reviewer.registerPolicy('p1', '정책', []);
    expect(() => reviewer.analyzeGaps('p1', 'pipa', 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 정책 분석 시 오류를 던진다', () => {
    reviewer.registerRegulation('pipa', '법', []);
    expect(() => reviewer.analyzeGaps('unknown', 'pipa')).toThrow('정책 미등록');
  });

  it('권고사항에 필수 갭이 포함된다', () => {
    reviewer.registerRegulation('pipa', '개인정보보호법', [
      { id: 'art-1', requirement: '동의 관리', mandatory: true },
    ]);
    reviewer.registerPolicy('p1', '정책', []);
    const report = reviewer.generateReport('p1');
    expect(report.recommendations.some(r => r.includes('필수'))).toBe(true);
  });
});
