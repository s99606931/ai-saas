// MTU-N369 점검 일정 관리 테스트
import { describe, it, expect } from 'vitest';
import { MaintenanceWindowManagerService } from '../maintenance-window-manager.js';

describe('MTU-N369 MaintenanceWindowManager', () => {
  const svc = new MaintenanceWindowManagerService('tenant-n369');

  it('FR-N369.1: 점검 일정 등록', () => {
    const w = svc.schedule('DB 패치', '2026-05-01T02:00:00Z', '2026-05-01T04:00:00Z', ['db', 'api']);
    expect(w.status).toBe('scheduled');
    expect(w.services).toContain('db');
  });

  it('FR-N369.2: 충돌 탐지', () => {
    svc.schedule('A', '2026-05-02T02:00:00Z', '2026-05-02T04:00:00Z', ['web']);
    svc.schedule('B', '2026-05-02T03:00:00Z', '2026-05-02T05:00:00Z', ['web']);
    const conflicts = svc.checkConflicts();
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it('FR-N369.3: 목록 조회', () => {
    expect(svc.list().length).toBeGreaterThan(0);
  });

  it('FR-N369.4: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
