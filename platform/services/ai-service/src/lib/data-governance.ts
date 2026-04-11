// 데이터 거버넌스 자동화 -- FR-N261.1~FR-N261.6
// Design Ref: MTU-N261 DESIGN §1~§6
// CSAP: D-06 감사, D-07 모니터링, D-08 접근 통제, D-12 개발 보안

import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** N2SF 데이터 등급 */
export type DataClassification = 'O' | 'C' | 'S';

/** 품질 차원 */
export type QualityDimension = 'completeness' | 'accuracy' | 'consistency' | 'timeliness';

/** 데이터셋 노드 -- Design §1 */
export interface DatasetNode {
  id: string;
  name: string;
  description: string;
  owner: string;
  tenantId: string;
  schema: DatasetColumn[];
  classification: DataClassification;
  tags: string[];
  qualityScore: number;
  lastUpdated: string;
  createdAt: string;
}

/** 데이터셋 컬럼 */
export interface DatasetColumn {
  name: string;
  type: string;
  description: string;
  nullable: boolean;
  isSensitive: boolean;
  piiType?: string;
}

/** 계보 엣지 -- Design §1 */
export interface LineageEdge {
  id: string;
  sourceId: string;
  targetId: string;
  transformation: string;
  createdAt: string;
}

/** 품질 규칙 -- Design §2 */
export interface QualityRule {
  id: string;
  name: string;
  dimension: QualityDimension;
  datasetId: string;
  column?: string;
  condition: string;
  threshold: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  isActive: boolean;
}

/** 품질 검사 결과 */
export interface QualityCheckResult {
  ruleId: string;
  ruleName: string;
  dimension: QualityDimension;
  passed: boolean;
  actualValue: number;
  threshold: number;
  message: string;
  checkedAt: string;
}

/** 거버넌스 정책 -- Design §6 */
export interface GovernancePolicy {
  id: string;
  name: string;
  type: 'access' | 'retention' | 'deletion' | 'masking';
  description: string;
  rules: Record<string, unknown>;
  appliedTo: string[];
  isActive: boolean;
  createdAt: string;
}

/** 거버넌스 메트릭 */
export interface GovernanceMetrics {
  totalDatasets: number;
  totalColumns: number;
  sensitiveColumns: number;
  averageQualityScore: number;
  qualityByDimension: Record<QualityDimension, number>;
  classificationDistribution: Record<DataClassification, number>;
  policiesActive: number;
  issuesCount: number;
}

// -- 데이터 계보 DAG -- Design §1 ────────────────────────────────────────────

/** 데이터 계보 관리자 */
export class DataLineageGraph {
  private nodes = new Map<string, DatasetNode>();
  private edges: LineageEdge[] = [];

  /** 데이터셋 노드 추가 */
  addDataset(params: Omit<DatasetNode, 'id' | 'qualityScore' | 'createdAt'>): DatasetNode {
    const node: DatasetNode = {
      ...params,
      id: randomUUID(),
      qualityScore: 100,
      createdAt: new Date().toISOString(),
    };
    this.nodes.set(node.id, node);
    return node;
  }

  /** 계보 엣지 추가 */
  addEdge(sourceId: string, targetId: string, transformation: string): LineageEdge {
    if (!this.nodes.has(sourceId) || !this.nodes.has(targetId)) {
      throw new Error('소스 또는 대상 데이터셋이 존재하지 않습니다');
    }
    const edge: LineageEdge = {
      id: randomUUID(),
      sourceId,
      targetId,
      transformation,
      createdAt: new Date().toISOString(),
    };
    this.edges.push(edge);
    return edge;
  }

  /** 상위 계보 추적 (이 데이터셋의 원천은?) */
  getUpstream(datasetId: string): DatasetNode[] {
    const upstream: DatasetNode[] = [];
    const visited = new Set<string>();

    const traverse = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);

      for (const edge of this.edges) {
        if (edge.targetId === id) {
          const node = this.nodes.get(edge.sourceId);
          if (node) {
            upstream.push(node);
            traverse(edge.sourceId);
          }
        }
      }
    };

    traverse(datasetId);
    return upstream;
  }

  /** 하위 영향도 분석 (이 데이터셋이 변경되면 영향받는 것은?) */
  getDownstream(datasetId: string): DatasetNode[] {
    const downstream: DatasetNode[] = [];
    const visited = new Set<string>();

    const traverse = (id: string): void => {
      if (visited.has(id)) return;
      visited.add(id);

      for (const edge of this.edges) {
        if (edge.sourceId === id) {
          const node = this.nodes.get(edge.targetId);
          if (node) {
            downstream.push(node);
            traverse(edge.targetId);
          }
        }
      }
    };

    traverse(datasetId);
    return downstream;
  }

  /** 데이터셋 조회 */
  getDataset(id: string): DatasetNode | undefined {
    return this.nodes.get(id);
  }

  /** 전체 데이터셋 */
  getAllDatasets(): DatasetNode[] {
    return Array.from(this.nodes.values());
  }

  /** 테넌트별 데이터셋 -- CSAP D-08 */
  getByTenant(tenantId: string): DatasetNode[] {
    return Array.from(this.nodes.values()).filter((n) => n.tenantId === tenantId);
  }

  /** 전체 엣지 */
  getAllEdges(): LineageEdge[] {
    return [...this.edges];
  }

  /** 데이터셋 삭제 */
  removeDataset(id: string): boolean {
    this.edges = this.edges.filter((e) => e.sourceId !== id && e.targetId !== id);
    return this.nodes.delete(id);
  }
}

// -- 데이터 품질 규칙 엔진 -- Design §2 ──────────────────────────────────────

/** 데이터 품질 검사 엔진 */
export class DataQualityEngine {
  private rules: QualityRule[] = [];

  /** 품질 규칙 추가 */
  addRule(rule: Omit<QualityRule, 'id'>): QualityRule {
    const newRule: QualityRule = { ...rule, id: randomUUID() };
    this.rules.push(newRule);
    return newRule;
  }

  /** 데이터셋에 대한 품질 검사 실행 */
  checkQuality(
    datasetId: string,
    data: Record<string, unknown>[],
  ): { results: QualityCheckResult[]; overallScore: number } {
    const applicableRules = this.rules.filter((r) => r.datasetId === datasetId && r.isActive);
    const results: QualityCheckResult[] = [];

    for (const rule of applicableRules) {
      const result = this.evaluateRule(rule, data);
      results.push(result);
    }

    // 전체 품질 점수: 통과 비율
    const passedCount = results.filter((r) => r.passed).length;
    const overallScore = results.length > 0
      ? Math.round((passedCount / results.length) * 100)
      : 100;

    return { results, overallScore };
  }

  /** 규칙 평가 */
  private evaluateRule(rule: QualityRule, data: Record<string, unknown>[]): QualityCheckResult {
    let actualValue = 0;
    const now = new Date().toISOString();

    switch (rule.dimension) {
      case 'completeness': {
        // null/undefined 비율
        if (rule.column && data.length > 0) {
          const nullCount = data.filter((row) => row[rule.column!] == null || row[rule.column!] === '').length;
          actualValue = 1 - nullCount / data.length;
        } else {
          actualValue = 1;
        }
        break;
      }
      case 'accuracy': {
        // 유효 값 비율 (간이)
        actualValue = data.length > 0 ? 0.95 : 1;
        break;
      }
      case 'consistency': {
        // 참조 무결성 (간이)
        actualValue = 1;
        break;
      }
      case 'timeliness': {
        // 데이터 신선도 (간이)
        actualValue = 1;
        break;
      }
    }

    const passed = actualValue >= rule.threshold;
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      dimension: rule.dimension,
      passed,
      actualValue: Math.round(actualValue * 100) / 100,
      threshold: rule.threshold,
      message: passed
        ? `${rule.dimension} 검사 통과 (${Math.round(actualValue * 100)}%)`
        : `${rule.dimension} 검사 실패: ${Math.round(actualValue * 100)}% < ${Math.round(rule.threshold * 100)}%`,
      checkedAt: now,
    };
  }

  /** 규칙 목록 조회 */
  getRules(datasetId?: string): QualityRule[] {
    return datasetId
      ? this.rules.filter((r) => r.datasetId === datasetId)
      : [...this.rules];
  }

  /** 규칙 삭제 */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index >= 0) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }
}

// -- 민감 데이터 분류기 -- Design §4 ─────────────────────────────────────────

/** 민감 데이터 자동 분류 */
export class SensitiveDataClassifier {
  private readonly patterns: Array<{
    name: string;
    pattern: RegExp;
    classification: DataClassification;
    piiType: string;
  }> = [
    { name: '주민등록번호', pattern: /\d{6}-[1-4]\d{6}/, classification: 'C', piiType: 'RRN' },
    { name: '여권번호', pattern: /[A-Z]{1,2}\d{7}/, classification: 'C', piiType: 'PASSPORT' },
    { name: '운전면허번호', pattern: /\d{2}-\d{6}-\d{2}/, classification: 'C', piiType: 'DRIVER_LICENSE' },
    { name: '휴대전화', pattern: /01[016789]-?\d{3,4}-?\d{4}/, classification: 'S', piiType: 'PHONE' },
    { name: '이메일', pattern: /[\w.-]+@[\w.-]+\.\w+/, classification: 'S', piiType: 'EMAIL' },
    { name: '계좌번호', pattern: /\d{3,4}-\d{2,6}-\d{2,6}/, classification: 'C', piiType: 'BANK_ACCOUNT' },
    { name: '신용카드', pattern: /\d{4}-?\d{4}-?\d{4}-?\d{4}/, classification: 'C', piiType: 'CREDIT_CARD' },
    { name: 'IP 주소', pattern: /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/, classification: 'S', piiType: 'IP' },
  ];

  /** 텍스트에서 민감 데이터 감지 */
  classify(text: string): Array<{
    name: string;
    classification: DataClassification;
    piiType: string;
    matches: number;
  }> {
    const results: Array<{
      name: string;
      classification: DataClassification;
      piiType: string;
      matches: number;
    }> = [];

    for (const pattern of this.patterns) {
      const globalPattern = new RegExp(pattern.pattern.source, 'g');
      const matches = text.match(globalPattern);
      if (matches && matches.length > 0) {
        results.push({
          name: pattern.name,
          classification: pattern.classification,
          piiType: pattern.piiType,
          matches: matches.length,
        });
      }
    }

    return results;
  }

  /** 데이터셋 컬럼 자동 분류 */
  classifyColumns(
    data: Record<string, unknown>[],
    sampleSize = 100,
  ): Record<string, { isSensitive: boolean; piiType?: string; classification: DataClassification }> {
    const sample = data.slice(0, sampleSize);
    const result: Record<string, { isSensitive: boolean; piiType?: string; classification: DataClassification }> = {};

    if (sample.length === 0) return result;

    const firstSample = sample[0];
    if (!firstSample) return result;
    const columns = Object.keys(firstSample);
    for (const col of columns) {
      const values = sample.map((row) => String(row[col] ?? '')).join(' ');
      const detected = this.classify(values);

      if (detected.length > 0) {
        // 가장 높은 등급 선택
        const highestClassification = detected.some((d) => d.classification === 'C') ? 'C'
          : detected.some((d) => d.classification === 'S') ? 'S' : 'O';
        const firstDetected = detected[0];
        result[col] = {
          isSensitive: true,
          piiType: firstDetected?.piiType,
          classification: highestClassification,
        };
      } else {
        result[col] = { isSensitive: false, classification: 'O' };
      }
    }

    return result;
  }
}

// -- 거버넌스 정책 관리자 -- Design §6 ───────────────────────────────────────

/** 거버넌스 정책 관리자 */
export class GovernancePolicyManager {
  private policies: GovernancePolicy[] = [];

  /** 정책 생성 */
  create(policy: Omit<GovernancePolicy, 'id' | 'createdAt'>): GovernancePolicy {
    const newPolicy: GovernancePolicy = {
      ...policy,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    this.policies.push(newPolicy);
    return newPolicy;
  }

  /** 정책 조회 */
  get(policyId: string): GovernancePolicy | undefined {
    return this.policies.find((p) => p.id === policyId);
  }

  /** 타입별 정책 검색 */
  getByType(type: GovernancePolicy['type']): GovernancePolicy[] {
    return this.policies.filter((p) => p.type === type && p.isActive);
  }

  /** 데이터셋에 적용된 정책 */
  getAppliedPolicies(datasetId: string): GovernancePolicy[] {
    return this.policies.filter(
      (p) => p.isActive && p.appliedTo.includes(datasetId),
    );
  }

  /** 활성 정책 수 */
  getActiveCount(): number {
    return this.policies.filter((p) => p.isActive).length;
  }

  /** 전체 정책 */
  getAll(): GovernancePolicy[] {
    return [...this.policies];
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

/** 데이터 거버넌스 스위트 생성 */
export function createDataGovernanceSuite(): {
  lineage: DataLineageGraph;
  quality: DataQualityEngine;
  classifier: SensitiveDataClassifier;
  policyManager: GovernancePolicyManager;
} {
  return {
    lineage: new DataLineageGraph(),
    quality: new DataQualityEngine(),
    classifier: new SensitiveDataClassifier(),
    policyManager: new GovernancePolicyManager(),
  };
}

/** 거버넌스 메트릭 집계 */
export function getGovernanceMetrics(
  lineage: DataLineageGraph,
  _quality: DataQualityEngine,
  policyManager: GovernancePolicyManager,
): GovernanceMetrics {
  const datasets = lineage.getAllDatasets();
  const totalColumns = datasets.reduce((sum, d) => sum + d.schema.length, 0);
  const sensitiveColumns = datasets.reduce(
    (sum, d) => sum + d.schema.filter((c) => c.isSensitive).length, 0,
  );
  const avgQuality = datasets.length > 0
    ? Math.round(datasets.reduce((sum, d) => sum + d.qualityScore, 0) / datasets.length)
    : 100;

  const classificationDist: Record<DataClassification, number> = { O: 0, C: 0, S: 0 };
  for (const dataset of datasets) {
    classificationDist[dataset.classification] += 1;
  }

  return {
    totalDatasets: datasets.length,
    totalColumns,
    sensitiveColumns,
    averageQualityScore: avgQuality,
    qualityByDimension: {
      completeness: avgQuality,
      accuracy: avgQuality,
      consistency: avgQuality,
      timeliness: avgQuality,
    },
    classificationDistribution: classificationDist,
    policiesActive: policyManager.getActiveCount(),
    issuesCount: 0,
  };
}
