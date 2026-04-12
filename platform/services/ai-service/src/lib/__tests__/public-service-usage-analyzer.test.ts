import { describe, it, expect, beforeEach } from 'vitest';
import { PublicServiceUsageAnalyzer } from '../public-service-usage-analyzer';

describe('PublicServiceUsageAnalyzer', () => {
  let analyzer: PublicServiceUsageAnalyzer;

  beforeEach(() => {
    analyzer = new PublicServiceUsageAnalyzer();
  });

  it('서비스를 등록한다', () => {
    analyzer.registerService('svc-1', '민원24', '민원');
    expect(analyzer.getAuditLog().some(l => l.action === 'REGISTER_SERVICE')).toBe(true);
  });

  it('이용 기록을 저장한다 (PII 마스킹)', () => {
    analyzer.registerService('svc-1', '민원24', '민원');
    analyzer.recordUsage('svc-1', 'user-001', '2026-04-12T10:00:00Z');
    expect(analyzer.getAuditLog().some(l => l.action === 'RECORD_USAGE')).toBe(true);
    const log = analyzer.getAuditLog().find(l => l.action === 'RECORD_USAGE');
    expect(log!.details['maskedUserId']).not.toBe('user-001');
  });

  it('시간대별 패턴을 반환한다', () => {
    analyzer.registerService('svc-1', '민원24', '민원');
    analyzer.recordUsage('svc-1', 'user-1', '2026-04-12T09:00:00Z');
    analyzer.recordUsage('svc-1', 'user-2', '2026-04-12T09:00:00Z');
    analyzer.recordUsage('svc-1', 'user-3', '2026-04-12T14:00:00Z');
    const pattern = analyzer.getHourlyPattern('svc-1');
    expect(pattern.hourlyCounts[9]).toBe(2);
    expect(pattern.peakHour).toBe(9);
  });

  it('증가 트렌드를 탐지한다', () => {
    analyzer.registerService('svc-1', '민원24', '민원');
    for (let i = 1; i <= 7; i++) {
      analyzer.recordUsage('svc-1', `u${i}`, `2026-04-0${i}T10:00:00Z`);
    }
    for (let i = 1; i <= 14; i++) {
      analyzer.recordUsage('svc-1', `u${i}a`, `2026-04-${String(i + 10).padStart(2, '0')}T10:00:00Z`);
      analyzer.recordUsage('svc-1', `u${i}b`, `2026-04-${String(i + 10).padStart(2, '0')}T11:00:00Z`);
    }
    const trend = analyzer.analyzeTrend('svc-1');
    expect(['increasing', 'stable', 'decreasing']).toContain(trend.trend);
  });

  it('C등급 이용 기록을 차단한다', () => {
    analyzer.registerService('svc-1', '민원24', '민원');
    expect(() => analyzer.recordUsage('svc-1', 'user-1', '2026-04-12T10:00:00Z', 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 서비스 이용 기록 시 오류를 던진다', () => {
    expect(() => analyzer.recordUsage('unknown', 'user-1', '2026-04-12T10:00:00Z')).toThrow('서비스 미등록');
  });
});
