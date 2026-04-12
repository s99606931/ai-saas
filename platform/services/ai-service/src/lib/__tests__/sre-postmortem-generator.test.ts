// MTU-N292 SRE 포스트모텀 자동 생성 테스트
import { describe, it, expect } from 'vitest';
import { SREPostmortemGeneratorService } from '../sre-postmortem-generator.js';

describe('MTU-N292 SREPostmortemGenerator', () => {
  const svc = new SREPostmortemGeneratorService('tenant-n292');

  it('FR-N292.1~6: 포스트모텀 생성 + 감사', () => {
    const incident = {
      incidentId: 'inc-1',
      title: '결제 서비스 5분간 다운',
      severity: 'P1' as const,
      status: 'resolved' as const,
      detectedAt: '2026-04-11T09:00:00Z',
      resolvedAt: '2026-04-11T09:05:00Z',
      affectedServices: ['payment', 'checkout'],
      impactDescription: '거래 200건 실패',
      responders: ['sre-1', 'dev-1'],
    };
    const logs = [
      { timestamp: '2026-04-11T09:00:00Z', source: 'alert' as const, message: 'CPU 95%', severity: 'critical' as const },
      { timestamp: '2026-04-11T09:01:00Z', source: 'log' as const, message: 'OOM killed', severity: 'critical' as const },
    ];
    const metrics = [
      {
        metricName: 'cpu',
        normalValue: 50,
        anomalyValue: 95,
        unit: '%',
        detectedAt: '2026-04-11T09:00:00Z',
        duration: 5,
      },
    ];
    const pm = svc.generate(incident, logs, metrics);
    expect(pm.postmortemId).toBeDefined();
    expect(pm.timeline.length).toBeGreaterThan(0);
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
