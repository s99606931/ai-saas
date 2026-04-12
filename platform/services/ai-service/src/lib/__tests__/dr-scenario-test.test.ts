// MTU-N294 DR 시나리오 테스트
import { describe, it, expect } from 'vitest';
import {
  registerScenario,
  simulateScenario,
  generateDRReport,
  scheduleScenario,
  listSchedules,
  DRScenarioTestService,
} from '../dr-scenario-test.js';

describe('MTU-N294 DRScenarioTest', () => {
  const tenantId = 'tenant-n294';

  it('FR-N294.1/2/3: 시나리오 등록 + 시뮬레이션', () => {
    registerScenario({
      scenarioId: 'sc-1',
      name: 'DB 장애 복구',
      category: 'database_failure',
      targetSystem: 'postgres',
      expectedRtoSec: 300,
      expectedRpoSec: 60,
    });

    const r = simulateScenario('sc-1', tenantId, 'sre-1', {
      mockFailureSec: 5,
      mockRecoverySec: 200,
      mockDataLossSec: 30,
      mockSuccess: true,
    });

    expect(r.success).toBe(true);
    expect(r.rtoMet).toBe(true);
    expect(r.rpoMet).toBe(true);
  });

  it('FR-N294.3: RTO 미달 (실패)', () => {
    registerScenario({
      scenarioId: 'sc-2',
      name: '네트워크 분할',
      category: 'network_partition',
      targetSystem: 'mesh',
      expectedRtoSec: 60,
      expectedRpoSec: 10,
    });

    const r = simulateScenario('sc-2', tenantId, 'sre-1', {
      mockFailureSec: 5,
      mockRecoverySec: 120,
      mockDataLossSec: 5,
      mockSuccess: true,
    });

    expect(r.rtoMet).toBe(false);
  });

  it('FR-N294.4: 리포트 생성', () => {
    const from = '2020-01-01T00:00:00Z';
    const to = '2030-01-01T00:00:00Z';
    const report = generateDRReport(tenantId, from, to);
    expect(report.reportId).toMatch(/^dr-rep-/);
    expect(report.totalScenarios).toBeGreaterThanOrEqual(0);
    expect(report.rtoComplianceRate).toBeGreaterThanOrEqual(0);
  });

  it('FR-N294.5: 스케줄', () => {
    scheduleScenario({
      scheduleId: 'sch-1',
      scenarioId: 'sc-1',
      cron: '0 2 * * 0',
      enabled: true,
    });
    expect(listSchedules().length).toBeGreaterThan(0);
  });

  it('FR-N294.6: Service + 감사', () => {
    const svc = new DRScenarioTestService('tenant-svc-n294');
    svc.register({
      scenarioId: 'svc-sc',
      name: 'svc test',
      category: 'pod_failure',
      targetSystem: 'k3s',
      expectedRtoSec: 60,
      expectedRpoSec: 10,
    });
    svc.simulate('svc-sc', { mockFailureSec: 1, mockRecoverySec: 30, mockDataLossSec: 5, mockSuccess: true });
    expect(svc.audit().length).toBeGreaterThan(0);
  });

  it('존재하지 않는 시나리오 차단', () => {
    expect(() =>
      simulateScenario('nonexistent', tenantId, 'u', { mockFailureSec: 1, mockRecoverySec: 1, mockDataLossSec: 1, mockSuccess: true }),
    ).toThrow(/SCENARIO_NOT_FOUND/);
  });
});
