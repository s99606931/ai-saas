import { describe, it, expect, beforeEach } from 'vitest';
import { DevEnvProvisioner } from '../dev-env-provisioner.js';

describe('DevEnvProvisioner', () => {
  let prov: DevEnvProvisioner;

  beforeEach(() => {
    prov = new DevEnvProvisioner();
    prov.registerProfile({
      id: 'p1',
      name: '풀스택 Node',
      runtime: 'node',
      services: ['postgres', 'redis'],
      resources: { cpu: 2, memoryGb: 4, storageGb: 20 },
      lifetimeHours: 8,
    });
    prov.setQuota({
      tenantId: 't1',
      maxCpu: 8,
      maxMemoryGb: 16,
      maxStorageGb: 100,
      maxActiveEnvs: 3,
    });
  });

  it('정상 프로비저닝', () => {
    const plan = prov.provision('plan-1', 't1', 'user-1', 'p1');
    expect(plan.status).toBe('pending');
    expect(plan.steps.length).toBeGreaterThan(0);
  });

  it('활성화 후 회수', () => {
    prov.provision('plan-2', 't1', 'user-1', 'p1');
    prov.activate('plan-2');
    const future = new Date(Date.now() + 100 * 3600_000);
    const reaped = prov.reapExpired(future);
    expect(reaped).toContain('plan-2');
  });

  it('프로파일 미존재', () => {
    expect(() => prov.provision('p', 't1', 'u', 'unknown')).toThrow('PROFILE_NOT_FOUND');
  });

  it('쿼터 초과', () => {
    prov.setQuota({ tenantId: 't2', maxCpu: 1, maxMemoryGb: 1, maxStorageGb: 1, maxActiveEnvs: 1 });
    expect(() => prov.provision('p', 't2', 'u', 'p1')).toThrow('QUOTA_EXCEEDED');
  });

  it('종료 상태 전환', () => {
    prov.provision('plan-3', 't1', 'u', 'p1');
    const p = prov.terminate('plan-3');
    expect(p.status).toBe('terminated');
  });
});
