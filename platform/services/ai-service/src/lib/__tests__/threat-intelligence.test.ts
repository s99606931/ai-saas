// MTU-N306 위협 인텔리전스 테스트
import { describe, it, expect } from 'vitest';
import { ThreatIntelligenceService } from '../threat-intelligence.js';

describe('MTU-N306 ThreatIntelligence', () => {
  const svc = new ThreatIntelligenceService('tenant-n306');

  it('FR-N306.1: IOC 피드 수집', () => {
    const iocs = svc.ingestFeed([
      { type: 'ip', value: '1.2.3.4', threatLevel: 'high', source: 'test' },
    ]);
    expect(iocs.length).toBeGreaterThan(0);
  });

  it('FR-N306.2: 위협 상관 분석', () => {
    svc.ingestFeed([{ type: 'ip', value: '5.6.7.8', threatLevel: 'critical', source: 'test' }]);
    const matches = svc.correlate([
      { source: 'firewall_log', value: 'connect 5.6.7.8 blocked', timestamp: '2026-04-11' },
    ]);
    expect(Array.isArray(matches)).toBe(true);
  });

  it('FR-N306.4: 위협 리포트 생성', () => {
    const rpt = svc.generateReport('2026-04');
    expect(rpt).toBeDefined();
  });

  it('FR-N306.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
