// MTU-N354 사고 타임라인 빌더 테스트
import { describe, it, expect } from 'vitest';
import { IncidentTimelineBuilderService } from '../incident-timeline-builder.js';

describe('MTU-N354 IncidentTimelineBuilder', () => {
  const svc = new IncidentTimelineBuilderService('tenant-n354');

  it('FR-N354.1: 이벤트 생성', () => {
    const e = svc.event('monitoring', 'alert', 'CPU 스파이크', 'critical', '2026-04-11T10:00:00Z');
    expect(e).toBeDefined();
  });

  it('FR-N354.2: 타임라인 빌드', () => {
    const e1 = svc.event('alert', 'alert', 'error', 'critical', '2026-04-11T10:00:00Z');
    const e2 = svc.event('log', 'log', 'rebooting', 'info', '2026-04-11T10:05:00Z');
    const timeline = svc.build('inc-1', [e1, e2]);
    expect(timeline).toBeDefined();
  });

  it('FR-N354.3: 이벤트 상관 분석', () => {
    const e1 = svc.event('a', 'alert', 'A fired', 'warning', '2026-04-11T10:00:00Z');
    const e2 = svc.event('b', 'alert', 'B fired', 'warning', '2026-04-11T10:00:30Z');
    const groups = svc.correlate([e1, e2], 60);
    expect(Array.isArray(groups)).toBe(true);
  });

  it('FR-N354.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
