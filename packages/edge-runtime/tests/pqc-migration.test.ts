/**
 * 양자내성 암호 마이그레이션 테스트
 * Plan SC: FR-PQC.1~5
 */

import { PqcMigrationPlanner, HybridTlsConfigGenerator } from '../src/pqc-migration';

describe('PqcMigrationPlanner', () => {
  const p = new PqcMigrationPlanner();

  it('scan: RSA-2048 인식 + critical 위험', () => {
    const result = p.scan([{ location: '/etc/ssl/key.pem', algorithm: 'RSA-2048' }]);
    expect(result.length).toBe(1);
    expect(result[0]?.riskLevel).toBe('critical');
  });

  it('scan: ECDSA-P256 인식 + high', () => {
    const result = p.scan([{ location: '/x', algorithm: 'ECDSA-P256' }]);
    expect(result[0]?.riskLevel).toBe('high');
  });

  it('scan: 알 수 없는 알고리즘 무시', () => {
    const result = p.scan([{ location: '/x', algorithm: 'UNKNOWN-ALGO' }]);
    expect(result).toEqual([]);
  });

  it('recommend: RSA-2048 → ML-KEM-768 + ML-DSA-65', () => {
    const usages = p.scan([{ location: '/x', algorithm: 'RSA-2048' }]);
    const r = p.recommend(usages[0]!);
    expect(r.targetSignature).toBe('ML-DSA-65');
    expect(r.targetKex).toBe('ML-KEM-768');
    expect(r.hybridMode).toBe(true);
  });

  it('plan: 위험도별 3단계 분류', () => {
    const usages = p.scan([
      { location: '/a', algorithm: 'RSA-2048' },
      { location: '/b', algorithm: 'ECDSA-P256' },
      { location: '/c', algorithm: 'ECDSA-P384' },
    ]);
    const plan = p.plan(usages);
    expect(plan.totalItems).toBe(3);
    expect(plan.phases.length).toBe(3);
    expect(plan.phases[0]?.items.length).toBe(1); // critical
    expect(plan.phases[1]?.items.length).toBe(1); // high
    expect(plan.phases[2]?.items.length).toBe(1); // medium
  });
});

describe('HybridTlsConfigGenerator', () => {
  const g = new HybridTlsConfigGenerator();

  it('TLS 1.3 + 하이브리드 keyExchange', () => {
    const c = g.generate('X25519', 'ML-KEM-768');
    expect(c.tlsVersion).toBe('TLSv1.3');
    expect(c.keyExchange).toBe('X25519+ML-KEM-768');
  });

  it('signatureScheme: ML-DSA 우선', () => {
    const c = g.generate('P-256', 'ML-DSA-87');
    expect(c.signatureScheme).toBe('ML-DSA-87');
  });

  it('ML-KEM 입력 시 기본 ML-DSA-65 사용', () => {
    const c = g.generate('X25519', 'ML-KEM-1024');
    expect(c.signatureScheme).toBe('ML-DSA-65');
  });
});
