import { describe, it, expect } from 'vitest';
import { RansomwareAi, type FileEvent, type ProcessEvent } from '../ransomware-ai';

describe('RansomwareAi', () => {
  const svc = new RansomwareAi();

  it('FR-RW.1 대량 암호화 탐지', () => {
    const events: FileEvent[] = Array.from({ length: 60 }, (_, i) => ({
      path: `/home/user/f${i}.doc.encrypted`,
      op: 'rename',
      entropyDelta: 0.5,
      at: '',
    }));
    expect(svc.detectMassEncryption(events)).toBe(true);
  });

  it('FR-RW.2 프로세스 분석', () => {
    const p: ProcessEvent = { pid: 100, name: 'evil.exe', parentPid: 1, opsPerSec: 500, suspiciousApis: ['CryptEncrypt', 'DeleteShadowCopy'] };
    const r = svc.analyzeProcess(p);
    expect(r.suspicious).toBe(true);
  });

  it('FR-RW.3 격리', () => {
    const a = svc.triggerIsolation(100, 'critical');
    expect(a.action).toBe('kill');
  });

  it('FR-RW.4 복구 지점 선택', () => {
    const points = [
      { snapshotId: 's1', takenAt: '2026-04-10T00:00:00Z', affectedFiles: 0 },
      { snapshotId: 's2', takenAt: '2026-04-11T00:00:00Z', affectedFiles: 0 },
    ];
    const p = svc.selectRecoveryPoint(points, '2026-04-11T12:00:00Z');
    expect(p?.snapshotId).toBe('s2');
  });

  it('FR-RW.5 알림 빌드', () => {
    const events: FileEvent[] = Array.from({ length: 60 }, (_, i) => ({ path: `/f${i}`, op: 'write', entropyDelta: 0.5, at: '' }));
    const p: ProcessEvent = { pid: 1, name: 'x', parentPid: 0, opsPerSec: 200, suspiciousApis: ['CryptEncrypt'] };
    const alert = svc.buildAlert(events, p);
    expect(alert.severity).toBe('critical');
  });
});
