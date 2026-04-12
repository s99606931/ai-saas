import { describe, it, expect, beforeEach } from 'vitest';
import { PqcMigration, type CipherInventoryEntry } from '../pqc-migration';

describe('PqcMigration', () => {
  let svc: PqcMigration;

  beforeEach(() => {
    svc = new PqcMigration();
  });

  it('FR-PQC.1 스캔', () => {
    const inv: CipherInventoryEntry[] = [
      { id: 'k1', location: 'tls-cert', algorithm: 'RSA', keySize: 2048, usage: 'auth' },
      { id: 'k2', location: 'ssh', algorithm: 'ECDSA', keySize: 256, usage: 'signature' },
    ];
    const r = svc.scanInventory(inv);
    expect(r.length).toBe(2);
  });

  it('FR-PQC.2 매핑', () => {
    expect(svc.mapToPqc('RSA')?.pqc).toBe('ML-KEM');
    expect(svc.mapToPqc('ECDSA')?.pqc).toBe('ML-DSA');
  });

  it('FR-PQC.3 하이브리드 TLS', () => {
    const cfg = svc.generateHybridTls();
    expect(cfg.pqc).toContain('ML-KEM');
  });

  it('FR-PQC.4 마이그레이션 계획', () => {
    svc.scanInventory([{ id: 'k1', location: 'tls', algorithm: 'RSA', keySize: 2048, usage: 'auth' }]);
    const plan = svc.generatePlan(new Date('2026-04-11'));
    expect(plan.total).toBe(1);
    expect(plan.steps.length).toBe(5);
  });

  it('FR-PQC.5 테스트 벡터', () => {
    const v = svc.getTestVector('ML-DSA');
    expect(v.sigLen).toBe(2420);
  });
});
