// 개인정보 자동 마스킹 + 합성 데이터 생성 -- FR-N272.1~FR-N272.6
// Design Ref: MTU-N272 DESIGN §1~§6
// CSAP: D-06 감사, D-09 암호화/데이터 보호, D-12 개발 보안
// N2SF: C/S등급 데이터 보호, 원본 데이터 외부 전송 금지

import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** PII 유형 -- Design §1 */
export type PIIType = 'name' | 'rrn' | 'phone' | 'email' | 'address' | 'card' | 'account';

/** 마스킹 전략 -- Design §2 */
export type MaskingStrategy = 'replace' | 'obfuscate' | 'tokenize' | 'generalize' | 'suppress';

/** PII 탐지 결과 -- Design §1 */
export interface PIIDetection {
  type: PIIType;
  value: string;
  position: { start: number; end: number };
  confidence: number;
}

/** 마스킹 규칙 -- Design §2 */
export interface MaskingRule {
  id: string;
  piiType: PIIType;
  strategy: MaskingStrategy;
  replacePattern?: string;
  isActive: boolean;
}

/** 마스킹 결과 */
export interface MaskingResult {
  originalLength: number;
  maskedText: string;
  detections: PIIDetection[];
  appliedRules: string[];
  processedAt: string;
}

/** 합성 데이터 레코드 */
export interface SyntheticRecord {
  [key: string]: string | number | boolean | null;
}

/** 합성 데이터 생성 설정 -- Design §3 */
export interface SyntheticConfig {
  schema: FieldSchema[];
  rowCount: number;
  preserveDistribution: boolean;
  seed?: number;
}

/** 필드 스키마 */
export interface FieldSchema {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'category';
  piiType?: PIIType;
  categories?: string[];
  min?: number;
  max?: number;
  distribution?: 'uniform' | 'normal' | 'exponential';
}

/** 품질 검증 결과 -- Design §4 */
export interface QualityValidation {
  overallScore: number;
  fieldScores: { field: string; score: number; metric: string }[];
  isAcceptable: boolean;
  validatedAt: string;
}

/** 감사 항목 */
export interface SyntheticAuditEntry {
  id: string;
  action: string;
  actor: string;
  details: Record<string, unknown>;
  timestamp: string;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: SyntheticAuditEntry[] = [];

function recordAudit(action: string, actor: string, details: Record<string, unknown>): void {
  auditLog.push({ id: randomUUID(), action, actor, details, timestamp: new Date().toISOString() });
}

export function getSyntheticAuditLog(): SyntheticAuditEntry[] {
  return [...auditLog];
}

// -- §1 PII 자동 탐지 ────────────────────────────────────────────────────────

/** PII 탐지 패턴 */
const PII_PATTERNS: { type: PIIType; pattern: RegExp; confidence: number }[] = [
  { type: 'rrn', pattern: /\d{6}-[1-4]\d{6}/g, confidence: 0.95 },
  { type: 'phone', pattern: /01[0-9]-\d{3,4}-\d{4}/g, confidence: 0.90 },
  { type: 'email', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, confidence: 0.95 },
  { type: 'card', pattern: /\d{4}-\d{4}-\d{4}-\d{4}/g, confidence: 0.90 },
  { type: 'account', pattern: /\d{3}-\d{2,6}-\d{4,8}/g, confidence: 0.70 },
  { type: 'name', pattern: /[가-힣]{2,4}(?=님|씨|과장|대리|부장|차장|사원)/g, confidence: 0.60 },
];

/** PII 자동 탐지 -- FR-N272.1, CSAP D-09 */
export function detectPII(text: string): PIIDetection[] {
  const detections: PIIDetection[] = [];

  for (const { type, pattern, confidence } of PII_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      detections.push({
        type,
        value: match[0],
        position: { start: match.index, end: match.index + match[0].length },
        confidence,
      });
    }
  }

  return detections.sort((a, b) => a.position.start - b.position.start);
}

// -- §2 마스킹 전략 ──────────────────────────────────────────────────────────

const defaultRules: MaskingRule[] = [
  { id: 'r-rrn', piiType: 'rrn', strategy: 'replace', replacePattern: '******-*******', isActive: true },
  { id: 'r-phone', piiType: 'phone', strategy: 'obfuscate', isActive: true },
  { id: 'r-email', piiType: 'email', strategy: 'obfuscate', isActive: true },
  { id: 'r-name', piiType: 'name', strategy: 'replace', replacePattern: '***', isActive: true },
  { id: 'r-card', piiType: 'card', strategy: 'replace', replacePattern: '****-****-****-****', isActive: true },
  { id: 'r-account', piiType: 'account', strategy: 'obfuscate', isActive: true },
];

/** 텍스트 마스킹 -- FR-N272.2 */
export function maskText(text: string, rules?: MaskingRule[], actor?: string): MaskingResult {
  const activeRules = (rules || defaultRules).filter((r) => r.isActive);
  const detections = detectPII(text);
  let maskedText = text;
  const appliedRules: string[] = [];

  // 역순으로 치환 (위치 변경 방지)
  const sorted = [...detections].sort((a, b) => b.position.start - a.position.start);

  for (const detection of sorted) {
    const rule = activeRules.find((r) => r.piiType === detection.type);
    if (!rule) continue;

    let replacement: string;
    switch (rule.strategy) {
      case 'replace':
        replacement = rule.replacePattern || '*'.repeat(detection.value.length);
        break;
      case 'obfuscate':
        replacement = obfuscateValue(detection.value);
        break;
      case 'tokenize':
        replacement = `[TOK:${randomUUID().substring(0, 8)}]`;
        break;
      case 'generalize':
        replacement = `[${detection.type.toUpperCase()}]`;
        break;
      case 'suppress':
        replacement = '';
        break;
    }

    maskedText = maskedText.substring(0, detection.position.start)
      + replacement
      + maskedText.substring(detection.position.end);
    appliedRules.push(rule.id);
  }

  if (actor) {
    recordAudit('TEXT_MASKED', actor, { detectionCount: detections.length, rulesApplied: appliedRules.length });
  }

  return {
    originalLength: text.length,
    maskedText,
    detections,
    appliedRules: [...new Set(appliedRules)],
    processedAt: new Date().toISOString(),
  };
}

/** 난독화 (첫/끝 글자 유지, 중간 마스킹) */
function obfuscateValue(value: string): string {
  if (value.length <= 2) return '*'.repeat(value.length);
  return value[0] + '*'.repeat(value.length - 2) + value[value.length - 1];
}

// -- §3 합성 데이터 생성 ─────────────────────────────────────────────────────

/** 한국 이름 생성 풀 */
const KOREAN_SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임'];
const KOREAN_NAMES = ['민수', '지원', '서연', '준혁', '하은', '도윤', '수빈', '예진', '시우', '채원'];

/** 합성 데이터 생성 -- FR-N272.3 */
export function generateSyntheticData(config: SyntheticConfig, actor: string): SyntheticRecord[] {
  const records: SyntheticRecord[] = [];
  let rng = config.seed ?? Math.random() * 10000;

  function pseudoRandom(): number {
    rng = (rng * 1103515245 + 12345) % 2147483648;
    return rng / 2147483648;
  }

  for (let i = 0; i < config.rowCount; i++) {
    const record: SyntheticRecord = {};

    for (const field of config.schema) {
      switch (field.type) {
        case 'string':
          if (field.piiType === 'name') {
            const surname = KOREAN_SURNAMES[Math.floor(pseudoRandom() * KOREAN_SURNAMES.length)] ?? '김';
            const name = KOREAN_NAMES[Math.floor(pseudoRandom() * KOREAN_NAMES.length)] ?? '민수';
            record[field.name] = surname + name;
          } else if (field.piiType === 'email') {
            record[field.name] = `user${i}@example.com`;
          } else if (field.piiType === 'phone') {
            record[field.name] = `010-${String(Math.floor(pseudoRandom() * 9000 + 1000))}-${String(Math.floor(pseudoRandom() * 9000 + 1000))}`;
          } else {
            record[field.name] = `synthetic-${i}`;
          }
          break;
        case 'number': {
          const min = field.min ?? 0;
          const max = field.max ?? 100;
          if (field.distribution === 'normal') {
            // Box-Muller 근사
            const u1 = pseudoRandom();
            const u2 = pseudoRandom();
            const z = Math.sqrt(-2 * Math.log(u1 || 0.001)) * Math.cos(2 * Math.PI * u2);
            const mean = (min + max) / 2;
            const stddev = (max - min) / 6;
            record[field.name] = Math.max(min, Math.min(max, Math.round(mean + z * stddev)));
          } else {
            record[field.name] = Math.round(min + pseudoRandom() * (max - min));
          }
          break;
        }
        case 'date': {
          const start = new Date('2020-01-01').getTime();
          const end = new Date('2026-12-31').getTime();
          record[field.name] = new Date(start + pseudoRandom() * (end - start)).toISOString().substring(0, 10);
          break;
        }
        case 'boolean':
          record[field.name] = pseudoRandom() > 0.5;
          break;
        case 'category':
          if (field.categories && field.categories.length > 0) {
            record[field.name] = field.categories[Math.floor(pseudoRandom() * field.categories.length)] ?? field.categories[0] ?? null;
          } else {
            record[field.name] = `cat-${Math.floor(pseudoRandom() * 5)}`;
          }
          break;
      }
    }

    records.push(record);
  }

  recordAudit('SYNTHETIC_DATA_GENERATED', actor, { rowCount: config.rowCount, fieldCount: config.schema.length });
  return records;
}

// -- §4 품질 검증 ────────────────────────────────────────────────────────────

/** 합성 데이터 품질 검증 -- FR-N272.4 */
export function validateQuality(
  original: SyntheticRecord[],
  synthetic: SyntheticRecord[],
  fields: string[]
): QualityValidation {
  const fieldScores: QualityValidation['fieldScores'] = [];

  for (const field of fields) {
    const origValues = original.map((r) => r[field]).filter((v) => v !== null && v !== undefined);
    const synthValues = synthetic.map((r) => r[field]).filter((v) => v !== null && v !== undefined);

    if (typeof origValues[0] === 'number') {
      // 수치 필드: 평균/표준편차 유사도
      const origMean = (origValues as number[]).reduce((a, b) => a + b, 0) / origValues.length;
      const synthMean = (synthValues as number[]).reduce((a, b) => a + b, 0) / synthValues.length;
      const meanDiff = Math.abs(origMean - synthMean) / (Math.abs(origMean) || 1);
      const score = Math.max(0, 1 - meanDiff);
      fieldScores.push({ field, score, metric: `평균 유사도 (차이: ${(meanDiff * 100).toFixed(1)}%)` });
    } else {
      // 범주형 필드: 카테고리 분포 유사도
      const origDist = calculateDistribution(origValues as string[]);
      const synthDist = calculateDistribution(synthValues as string[]);
      const score = calculateDistributionSimilarity(origDist, synthDist);
      fieldScores.push({ field, score, metric: `분포 유사도` });
    }
  }

  const overallScore = fieldScores.length > 0
    ? fieldScores.reduce((sum, fs) => sum + fs.score, 0) / fieldScores.length
    : 0;

  return {
    overallScore,
    fieldScores,
    isAcceptable: overallScore >= 0.7,
    validatedAt: new Date().toISOString(),
  };
}

function calculateDistribution(values: string[]): Map<string, number> {
  const dist = new Map<string, number>();
  for (const v of values) {
    dist.set(String(v), (dist.get(String(v)) || 0) + 1);
  }
  for (const [k, v] of dist) {
    dist.set(k, v / values.length);
  }
  return dist;
}

function calculateDistributionSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  const allKeys = new Set([...a.keys(), ...b.keys()]);
  let similarity = 0;
  for (const key of allKeys) {
    const va = a.get(key) || 0;
    const vb = b.get(key) || 0;
    similarity += Math.min(va, vb);
  }
  return similarity;
}
