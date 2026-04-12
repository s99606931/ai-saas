// MTU-N338 설정 변경 추적 테스트
import { describe, it, expect } from 'vitest';
import { ConfigChangeTrackerService } from '../config-change-tracker.js';

describe('MTU-N338 ConfigChangeTracker', () => {
  const svc = new ConfigChangeTrackerService('tenant-n338');

  it('FR-N338.1: 스냅샷 저장', () => {
    const snap = svc.save('api-config', { replicas: 3, image: 'v1' }, 'admin');
    expect(snap).toBeDefined();
  });

  it('FR-N338.2: 히스토리 조회', () => {
    svc.save('db-config', { conn: 10 });
    const history = svc.history('db-config');
    expect(history.length).toBeGreaterThan(0);
  });

  it('FR-N338.3: 차이 분석', () => {
    const a = svc.save('cfg', { x: 1 });
    const b = svc.save('cfg', { x: 2 });
    const diffs = svc.diff(a, b);
    expect(Array.isArray(diffs)).toBe(true);
  });

  it('FR-N338.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
