// Design Ref: MTU-N468 §pqc-migration
// Plan SC: FR-PQC.1 ~ FR-PQC.5
//
// Post-Quantum Cryptography 마이그레이션 도우미.
// NIST PQC 표준: ML-KEM (FIPS 203), ML-DSA (FIPS 204), SLH-DSA (FIPS 205).
// 기존 알고리즘 스캔 + 매핑 + 하이브리드 TLS 설정 생성 + 마이그레이션 계획.

export type ClassicalAlgo =
  | 'RSA-2048'
  | 'RSA-3072'
  | 'RSA-4096'
  | 'ECDSA-P256'
  | 'ECDSA-P384'
  | 'ECDH-P256'
  | 'ECDH-P384'
  | 'Ed25519';

export type PqcAlgo =
  | 'ML-KEM-512'
  | 'ML-KEM-768'
  | 'ML-KEM-1024'
  | 'ML-DSA-44'
  | 'ML-DSA-65'
  | 'ML-DSA-87'
  | 'SLH-DSA-128s'
  | 'Ed25519'; // 하이브리드 시 유지

export interface AlgoUsage {
  location: string; // 파일·설정 경로
  algo: ClassicalAlgo;
  purpose: 'key_exchange' | 'signature' | 'encryption';
  riskLevel: 'high' | 'medium' | 'low';
}

export interface MigrationPlanEntry {
  location: string;
  from: ClassicalAlgo;
  to: PqcAlgo[];
  hybrid: boolean;
  phase: 1 | 2 | 3;
  notes?: string;
}

// FR-PQC.2: 알고리즘 매핑
const MAPPING: Record<ClassicalAlgo, { purpose: AlgoUsage['purpose']; to: PqcAlgo[] }> = {
  'RSA-2048': { purpose: 'key_exchange', to: ['ML-KEM-768', 'Ed25519'] },
  'RSA-3072': { purpose: 'key_exchange', to: ['ML-KEM-768', 'Ed25519'] },
  'RSA-4096': { purpose: 'key_exchange', to: ['ML-KEM-1024', 'Ed25519'] },
  'ECDSA-P256': { purpose: 'signature', to: ['ML-DSA-44'] },
  'ECDSA-P384': { purpose: 'signature', to: ['ML-DSA-65'] },
  'ECDH-P256': { purpose: 'key_exchange', to: ['ML-KEM-512'] },
  'ECDH-P384': { purpose: 'key_exchange', to: ['ML-KEM-768'] },
  'Ed25519': { purpose: 'signature', to: ['ML-DSA-44'] },
};

// FR-PQC.1: 기존 암호 사용 스캔 (간단화 — 텍스트 기반 탐지)
export function scanForClassicalAlgos(content: string, location: string): AlgoUsage[] {
  const results: AlgoUsage[] = [];
  const keys = Object.keys(MAPPING) as ClassicalAlgo[];
  for (const k of keys) {
    if (content.includes(k)) {
      results.push({
        location,
        algo: k,
        purpose: MAPPING[k].purpose,
        riskLevel: classicalRisk(k),
      });
    }
  }
  return results;
}

function classicalRisk(algo: ClassicalAlgo): 'high' | 'medium' | 'low' {
  // 2030년대 양자컴퓨터 등장 가정 하 RSA-2048/ECDSA-P256: high
  if (algo === 'RSA-2048' || algo === 'ECDSA-P256' || algo === 'ECDH-P256') return 'high';
  if (algo === 'RSA-3072') return 'medium';
  return 'low';
}

// FR-PQC.3: 하이브리드 TLS 설정 생성 (OpenSSL 3.x + oqs-provider 스타일)
export function hybridTlsConfig(usages: AlgoUsage[]): {
  groups: string;
  sigalgs: string;
  notes: string[];
} {
  const groups = new Set<string>();
  const sigalgs = new Set<string>();
  const notes: string[] = [];

  for (const u of usages) {
    const to = MAPPING[u.algo].to;
    if (u.purpose === 'key_exchange') {
      // 하이브리드 그룹: 기존 + PQC
      if (u.algo.startsWith('ECDH')) {
        const pqc = to[0];
        groups.add(`${u.algo.toLowerCase()}-${pqc.toLowerCase()}`);
      } else {
        groups.add(`x25519-${to[0].toLowerCase()}`);
      }
    }
    if (u.purpose === 'signature') {
      sigalgs.add(to[0].toLowerCase());
      sigalgs.add(u.algo.toLowerCase());
    }
  }

  notes.push('OpenSSL 3.x + oqs-provider 설치 필요');
  notes.push('Phase 1: 하이브리드 병행. Phase 2: PQC 우선. Phase 3: Classical 제거.');

  return {
    groups: Array.from(groups).join(':'),
    sigalgs: Array.from(sigalgs).join(':'),
    notes,
  };
}

// FR-PQC.4: 마이그레이션 계획 생성 (위험도 높은 항목부터 Phase 1)
export function buildMigrationPlan(usages: AlgoUsage[]): MigrationPlanEntry[] {
  return usages
    .map((u) => {
      const to = MAPPING[u.algo].to;
      const phase: 1 | 2 | 3 =
        u.riskLevel === 'high' ? 1 : u.riskLevel === 'medium' ? 2 : 3;
      return {
        location: u.location,
        from: u.algo,
        to,
        hybrid: true,
        phase,
        notes: `${u.purpose} → ${to.join('+')} (하이브리드)`,
      };
    })
    .sort((a, b) => a.phase - b.phase);
}

// FR-PQC.5: 테스트 벡터 (자체 검증용)
export function testVectors(): Array<{ algo: PqcAlgo; keyBytes: number; sigBytes?: number }> {
  // FIPS 203/204 사양 기반 공개 크기 (바이트)
  return [
    { algo: 'ML-KEM-512', keyBytes: 800 },
    { algo: 'ML-KEM-768', keyBytes: 1184 },
    { algo: 'ML-KEM-1024', keyBytes: 1568 },
    { algo: 'ML-DSA-44', keyBytes: 1312, sigBytes: 2420 },
    { algo: 'ML-DSA-65', keyBytes: 1952, sigBytes: 3293 },
    { algo: 'ML-DSA-87', keyBytes: 2592, sigBytes: 4595 },
  ];
}
