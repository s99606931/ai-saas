// MTU-N290 보안 컴플라이언스 AI 리포터 테스트
import { describe, it, expect } from 'vitest';
import { ComplianceAIReporterService } from '../compliance-ai-reporter.js';

describe('MTU-N290 ComplianceAIReporter', () => {
  const svc = new ComplianceAIReporterService('tenant-n290');

  it('FR-N290.1: CSAP 점검', () => {
    const r = svc.checkCSAP('u1');
    expect(Array.isArray(r)).toBe(true);
  });

  it('FR-N290.2: N2SF 점검', () => {
    const r = svc.checkN2SF('u1');
    expect(Array.isArray(r)).toBe(true);
  });

  it('FR-N290.3: 증적 수집', () => {
    const e = svc.collectEvidence('csap-d-08', 'document', '접근통제 증적', '/path/to/doc.pdf', '접근통제 정책 문서');
    expect(e.evidenceId).toBeDefined();
  });

  it('FR-N290.4: 대시보드', () => {
    const d = svc.getDashboard('u1');
    expect(d).toBeDefined();
  });

  it('FR-N290.5: 감사 리포트', () => {
    const r = svc.generateReport('u1', 'combined');
    expect(r.reportId).toBeDefined();
  });

  it('FR-N290.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
