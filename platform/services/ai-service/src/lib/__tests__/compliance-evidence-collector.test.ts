// MTU-N366 준수 증거 수집 테스트
import { describe, it, expect } from 'vitest';
import { ComplianceEvidenceCollectorService } from '../compliance-evidence-collector.js';

describe('MTU-N366 ComplianceEvidenceCollector', () => {
  const svc = new ComplianceEvidenceCollectorService('tenant-n366');

  it('FR-N366.1: 증거 정의', () => {
    const def = svc.define('CSAP', 'D-08', '접근 통제 로그', 'auto');
    expect(def.regulation).toBe('CSAP');
  });

  it('FR-N366.2: 증거 수집', () => {
    const def = svc.define('CSAP', 'D-09', '암호화 상태');
    const col = svc.collect(def.evidenceId, '{"encrypted":true}', 'config');
    expect(col.valid).toBe(true);
  });

  it('FR-N366.3: 증거 패키지 생성', () => {
    const def = svc.define('ISMS-P', 'A-01', '인증 정책');
    svc.collect(def.evidenceId, 'policy-ok', 'system');
    const pkg = svc.package('ISMS-P');
    expect(pkg.evidences.length).toBeGreaterThan(0);
  });

  it('FR-N366.4: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
