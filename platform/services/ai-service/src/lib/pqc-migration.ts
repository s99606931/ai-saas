// Design Ref: MTU-N468 §PQC 마이그레이션
// Plan SC: FR-PQC.1~5

export type ClassicalAlgo = 'RSA' | 'ECDSA' | 'DH' | 'ECDH';
export type PqcAlgo = 'ML-KEM' | 'ML-DSA' | 'SLH-DSA' | 'FALCON';

export interface CipherInventoryEntry {
  id: string;
  location: string;
  algorithm: ClassicalAlgo;
  keySize: number;
  usage: 'auth' | 'keyex' | 'signature';
}

export interface PqcMapping {
  classical: ClassicalAlgo;
  pqc: PqcAlgo;
  reason: string;
}

export interface HybridTlsConfig {
  classical: string;
  pqc: string;
  cipherSuite: string;
}

export interface MigrationPlan {
  total: number;
  migrated: number;
  pending: number;
  steps: Array<{ order: number; action: string; due: string }>;
}

export class PqcMigration {
  private inventory: CipherInventoryEntry[] = [];
  private mappings: PqcMapping[] = [
    { classical: 'RSA', pqc: 'ML-KEM', reason: '키 교환 대체 (RSA-KEM)' },
    { classical: 'ECDH', pqc: 'ML-KEM', reason: '키 교환 대체' },
    { classical: 'DH', pqc: 'ML-KEM', reason: '키 교환 대체' },
    { classical: 'ECDSA', pqc: 'ML-DSA', reason: '서명 대체 (Dilithium)' },
  ];

  /** FR-PQC.1 암호 스캔 */
  scanInventory(entries: CipherInventoryEntry[]): CipherInventoryEntry[] {
    this.inventory = [...entries];
    return [...this.inventory];
  }

  /** FR-PQC.2 PQC 매핑 */
  mapToPqc(classical: ClassicalAlgo): PqcMapping | undefined {
    return this.mappings.find((m) => m.classical === classical);
  }

  /** FR-PQC.3 하이브리드 TLS 설정 */
  generateHybridTls(): HybridTlsConfig {
    return {
      classical: 'X25519',
      pqc: 'ML-KEM-768',
      cipherSuite: 'TLS_AES_256_GCM_SHA384',
    };
  }

  /** FR-PQC.4 마이그레이션 계획 */
  generatePlan(startDate: Date): MigrationPlan {
    const total = this.inventory.length;
    const steps = [
      { order: 1, action: '인벤토리 완성', due: this.addDays(startDate, 14) },
      { order: 2, action: 'PQC 라이브러리 통합', due: this.addDays(startDate, 60) },
      { order: 3, action: '하이브리드 TLS 배포', due: this.addDays(startDate, 90) },
      { order: 4, action: '고위험 키 전환', due: this.addDays(startDate, 180) },
      { order: 5, action: '전면 전환 및 폐기', due: this.addDays(startDate, 365) },
    ];
    return { total, migrated: 0, pending: total, steps };
  }

  /** FR-PQC.5 테스트 벡터 (결정론적) */
  getTestVector(algo: PqcAlgo): { algo: PqcAlgo; seed: string; pubKeyLen: number; sigLen: number } {
    const specs: Record<PqcAlgo, { pubKeyLen: number; sigLen: number }> = {
      'ML-KEM': { pubKeyLen: 1184, sigLen: 0 },
      'ML-DSA': { pubKeyLen: 1312, sigLen: 2420 },
      'SLH-DSA': { pubKeyLen: 32, sigLen: 7856 },
      FALCON: { pubKeyLen: 897, sigLen: 690 },
    };
    const s = specs[algo];
    return { algo, seed: 'test-seed-0001', ...s };
  }

  private addDays(d: Date, days: number): string {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + days);
    return copy.toISOString().slice(0, 10);
  }
}

export const pqcMigration = new PqcMigration();
