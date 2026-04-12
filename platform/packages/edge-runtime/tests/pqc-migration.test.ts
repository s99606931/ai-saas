// Test Ref: MTU-N468 §pqc-migration
import { describe, it, expect } from 'vitest';
import {
  scanForClassicalAlgos,
  hybridTlsConfig,
  buildMigrationPlan,
  testVectors,
} from '../src/index.js';

describe('scanForClassicalAlgos — FR-PQC.1', () => {
  it('RSA-2048 탐지', () => {
    const results = scanForClassicalAlgos('ssl_certificate_key RSA-2048', '/etc/nginx/conf');
    expect(results.length).toBe(1);
    expect(results[0].algo).toBe('RSA-2048');
    expect(results[0].riskLevel).toBe('high');
  });

  it('여러 알고리즘 동시 탐지', () => {
    const results = scanForClassicalAlgos(
      'uses ECDSA-P256 and Ed25519',
      'app.ts',
    );
    expect(results.map((r) => r.algo).sort()).toEqual(['ECDSA-P256', 'Ed25519']);
  });
});

describe('hybridTlsConfig — FR-PQC.3', () => {
  it('하이브리드 그룹 생성', () => {
    const cfg = hybridTlsConfig([
      { location: 'x', algo: 'ECDH-P256', purpose: 'key_exchange', riskLevel: 'high' },
      { location: 'y', algo: 'ECDSA-P256', purpose: 'signature', riskLevel: 'high' },
    ]);
    expect(cfg.groups).toContain('ml-kem-512');
    expect(cfg.sigalgs).toContain('ml-dsa-44');
    expect(cfg.notes.length).toBeGreaterThan(0);
  });
});

describe('buildMigrationPlan — FR-PQC.4', () => {
  it('위험도 높은 항목부터 Phase 1', () => {
    const plan = buildMigrationPlan([
      { location: 'a', algo: 'RSA-4096', purpose: 'key_exchange', riskLevel: 'low' },
      { location: 'b', algo: 'RSA-2048', purpose: 'key_exchange', riskLevel: 'high' },
      { location: 'c', algo: 'RSA-3072', purpose: 'key_exchange', riskLevel: 'medium' },
    ]);
    expect(plan[0].phase).toBe(1);
    expect(plan[0].from).toBe('RSA-2048');
    expect(plan[2].phase).toBe(3);
  });
});

describe('testVectors — FR-PQC.5', () => {
  it('FIPS 203/204 공개 키 크기 포함', () => {
    const v = testVectors();
    expect(v.find((x) => x.algo === 'ML-KEM-768')?.keyBytes).toBe(1184);
    expect(v.find((x) => x.algo === 'ML-DSA-44')?.sigBytes).toBe(2420);
  });
});
