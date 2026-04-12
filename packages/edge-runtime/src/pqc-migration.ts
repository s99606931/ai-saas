/**
 * 양자내성 암호화 마이그레이션 어시스턴트
 * Design Ref: MTU-N468 §3
 * Plan SC: FR-PQC.1~5
 */

export type LegacyAlgorithm = 'RSA-2048' | 'RSA-4096' | 'ECDSA-P256' | 'ECDSA-P384' | 'DH-2048';
export type PqcAlgorithm = 'ML-KEM-768' | 'ML-KEM-1024' | 'ML-DSA-65' | 'ML-DSA-87' | 'SLH-DSA-SHA2-128s';

export interface AlgorithmUsage {
  location: string;
  algorithm: LegacyAlgorithm;
  purpose: 'key-exchange' | 'signature' | 'encryption';
  riskLevel: 'critical' | 'high' | 'medium';
}

/**
 * PQC 매핑 (FR-PQC.2)
 * NIST 선정 알고리즘 (2024 최종)
 */
const MIGRATION_MAP: Record<LegacyAlgorithm, { sig?: PqcAlgorithm; kex?: PqcAlgorithm }> = {
  'RSA-2048': { sig: 'ML-DSA-65', kex: 'ML-KEM-768' },
  'RSA-4096': { sig: 'ML-DSA-87', kex: 'ML-KEM-1024' },
  'ECDSA-P256': { sig: 'ML-DSA-65' },
  'ECDSA-P384': { sig: 'ML-DSA-87' },
  'DH-2048': { kex: 'ML-KEM-768' },
};

export class PqcMigrationPlanner {
  /**
   * 사용 현황 스캔 (FR-PQC.1)
   */
  scan(configs: Array<{ location: string; algorithm: string }>): AlgorithmUsage[] {
    const result: AlgorithmUsage[] = [];
    for (const config of configs) {
      const alg = this.parseAlgorithm(config.algorithm);
      if (!alg) continue;
      result.push({
        location: config.location,
        algorithm: alg,
        purpose: this.inferPurpose(alg),
        riskLevel: this.assessRisk(alg),
      });
    }
    return result;
  }

  private parseAlgorithm(raw: string): LegacyAlgorithm | null {
    const normalized = raw.toUpperCase().replace(/\s+/g, '');
    const known: LegacyAlgorithm[] = ['RSA-2048', 'RSA-4096', 'ECDSA-P256', 'ECDSA-P384', 'DH-2048'];
    return known.find((k) => normalized.includes(k.replace('-', ''))) ?? null;
  }

  private inferPurpose(alg: LegacyAlgorithm): AlgorithmUsage['purpose'] {
    if (alg.startsWith('DH')) return 'key-exchange';
    if (alg.startsWith('ECDSA')) return 'signature';
    return 'signature';
  }

  private assessRisk(alg: LegacyAlgorithm): AlgorithmUsage['riskLevel'] {
    if (alg === 'RSA-2048' || alg === 'DH-2048') return 'critical';
    if (alg === 'ECDSA-P256') return 'high';
    return 'medium';
  }

  /**
   * 마이그레이션 추천 (FR-PQC.2)
   */
  recommend(usage: AlgorithmUsage): {
    targetSignature?: PqcAlgorithm;
    targetKex?: PqcAlgorithm;
    hybridMode: boolean;
  } {
    const mapping = MIGRATION_MAP[usage.algorithm];
    return {
      targetSignature: mapping.sig,
      targetKex: mapping.kex,
      hybridMode: true,
    };
  }

  /**
   * 마이그레이션 계획 (FR-PQC.4)
   */
  plan(usages: AlgorithmUsage[]): {
    phases: Array<{ phase: number; items: AlgorithmUsage[]; targetDate: string }>;
    totalItems: number;
  } {
    const byRisk = {
      critical: usages.filter((u) => u.riskLevel === 'critical'),
      high: usages.filter((u) => u.riskLevel === 'high'),
      medium: usages.filter((u) => u.riskLevel === 'medium'),
    };
    const now = new Date();
    const phase1Date = new Date(now);
    phase1Date.setMonth(phase1Date.getMonth() + 3);
    const phase2Date = new Date(now);
    phase2Date.setMonth(phase2Date.getMonth() + 6);
    const phase3Date = new Date(now);
    phase3Date.setMonth(phase3Date.getMonth() + 12);

    return {
      phases: [
        { phase: 1, items: byRisk.critical, targetDate: phase1Date.toISOString().slice(0, 10) },
        { phase: 2, items: byRisk.high, targetDate: phase2Date.toISOString().slice(0, 10) },
        { phase: 3, items: byRisk.medium, targetDate: phase3Date.toISOString().slice(0, 10) },
      ],
      totalItems: usages.length,
    };
  }
}

/**
 * 하이브리드 TLS 설정 생성 (FR-PQC.3)
 */
export class HybridTlsConfigGenerator {
  generate(classicalCurve: 'X25519' | 'P-256', pqcAlgorithm: PqcAlgorithm): {
    tlsVersion: string;
    keyExchange: string;
    signatureScheme: string;
  } {
    return {
      tlsVersion: 'TLSv1.3',
      keyExchange: `${classicalCurve}+${pqcAlgorithm}`,
      signatureScheme: pqcAlgorithm.startsWith('ML-DSA') ? pqcAlgorithm : 'ML-DSA-65',
    };
  }
}
