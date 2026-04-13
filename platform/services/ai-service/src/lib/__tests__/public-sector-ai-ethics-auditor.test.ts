import { describe, it, expect, beforeEach } from 'vitest';
import { PublicSectorAIEthicsAuditor } from '../public-sector-ai-ethics-auditor';

describe('PublicSectorAIEthicsAuditor', () => {
  let auditor: PublicSectorAIEthicsAuditor;

  beforeEach(() => {
    auditor = new PublicSectorAIEthicsAuditor();
    auditor.registerSystem({
      id: 'sys1', agency: '복지부', purpose: '복지 대상자 선별',
      deployedAt: '2026-01-01', affectedPopulation: 500000,
    });
  });

  it('AI 시스템을 등록한다', () => {
    expect(auditor.getAuditLog().some(l => l.action === 'REGISTER_SYSTEM')).toBe(true);
  });

  it('증거를 기록한다', () => {
    auditor.recordEvidence({
      systemId: 'sys1', principle: 'transparency',
      evidenceType: 'model_card', passed: true, note: '공개됨',
    });
    expect(auditor.getAuditLog().some(l => l.action === 'RECORD_EVIDENCE')).toBe(true);
  });

  it('모든 원칙 통과 시 compliant', () => {
    const principles = ['transparency', 'fairness', 'accountability', 'explainability', 'privacy'] as const;
    for (const p of principles) {
      auditor.recordEvidence({
        systemId: 'sys1', principle: p,
        evidenceType: 'check', passed: true, note: 'ok',
      });
    }
    const report = auditor.audit('sys1');
    expect(report.overallScore).toBe(100);
    expect(report.riskLevel).toBe('compliant');
  });

  it('일부 실패 시 권고안 생성', () => {
    auditor.recordEvidence({
      systemId: 'sys1', principle: 'fairness',
      evidenceType: 'bias_test', passed: false, note: '성별 편향 감지',
    });
    const report = auditor.audit('sys1');
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it('증거 없는 원칙은 0점', () => {
    const report = auditor.audit('sys1');
    const transparency = report.scores.find(s => s.principle === 'transparency');
    expect(transparency?.score).toBe(0);
  });

  it('S등급 증거를 차단한다', () => {
    expect(() => auditor.recordEvidence({
      systemId: 'sys1', principle: 'privacy',
      evidenceType: 'dpia', passed: true, note: '완료',
    }, 'S' as unknown as never)).toThrow(/BLOCKED/);
  });
});
