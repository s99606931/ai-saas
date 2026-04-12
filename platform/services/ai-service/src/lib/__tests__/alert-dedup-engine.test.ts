// MTU-N370 알림 중복 제거 엔진 테스트
import { describe, it, expect } from 'vitest';
import { AlertDedupEngineService } from '../alert-dedup-engine.js';

describe('MTU-N370 AlertDedupEngine', () => {
  const svc = new AlertDedupEngineService('tenant-n370');

  it('FR-N370.1: 알림 생성 및 핑거프린트', () => {
    const a = svc.createAlert('node1', 'cpu', 'CPU 90%', 'warning');
    expect(a.fingerprint.length).toBeGreaterThan(0);
  });

  it('FR-N370.2: 중복 제거', () => {
    const alerts = [
      svc.createAlert('node1', 'cpu', 'CPU 91%', 'warning'),
      svc.createAlert('node1', 'cpu', 'CPU 92%', 'warning'),
      svc.createAlert('node2', 'mem', 'MEM 88%', 'warning'),
    ];
    const result = svc.deduplicate(alerts);
    expect(result.uniqueGroups).toBeLessThan(alerts.length);
    expect(result.deduplicatedCount).toBeGreaterThanOrEqual(1);
  });

  it('FR-N370.3: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
