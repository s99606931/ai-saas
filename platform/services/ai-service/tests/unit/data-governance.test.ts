// MTU-N261 단위 테스트: 데이터 거버넌스 자동화
// Design Ref: MTU-N261 DESIGN §1~§6
// Plan SC: FR-N261.1~FR-N261.6
// CSAP: D-06 감사, D-07 모니터링, D-08 접근 통제, D-12 개발 보안

import { describe, it, expect, beforeEach } from 'vitest';

import {
  DataLineageGraph,
  DataQualityEngine,
  SensitiveDataClassifier,
  GovernancePolicyManager,
  createDataGovernanceSuite,
  getGovernanceMetrics,
  type DatasetNode,
} from '../../src/lib/data-governance.js';

// -- DataLineageGraph -- Design §1 ──────────────────────────────────────

describe('DataLineageGraph (FR-N261.1)', () => {
  let graph: DataLineageGraph;

  beforeEach(() => {
    graph = new DataLineageGraph();
  });

  it('데이터셋 노드를 추가한다', () => {
    const node = graph.addDataset({
      name: 'users',
      description: '사용자 데이터',
      owner: 'admin',
      tenantId: 'tenant-A',
      schema: [
        { name: 'id', type: 'uuid', description: 'ID', nullable: false, isSensitive: false },
        { name: 'email', type: 'string', description: '이메일', nullable: false, isSensitive: true, piiType: 'EMAIL' },
      ],
      classification: 'S',
      tags: ['user', 'pii'],
      lastUpdated: new Date().toISOString(),
    });
    expect(node.id).toBeTruthy();
    expect(node.qualityScore).toBe(100);
    expect(graph.getAllDatasets()).toHaveLength(1);
  });

  it('계보 엣지를 추가한다', () => {
    const source = graph.addDataset({
      name: 'raw_logs', description: '', owner: 'admin',
      tenantId: 'tenant-A', schema: [], classification: 'O',
      tags: [], lastUpdated: new Date().toISOString(),
    });
    const target = graph.addDataset({
      name: 'processed_logs', description: '', owner: 'admin',
      tenantId: 'tenant-A', schema: [], classification: 'O',
      tags: [], lastUpdated: new Date().toISOString(),
    });
    const edge = graph.addEdge(source.id, target.id, 'ETL transform');
    expect(edge.sourceId).toBe(source.id);
    expect(edge.targetId).toBe(target.id);
  });

  it('존재하지 않는 노드에 엣지 추가 시 에러', () => {
    const node = graph.addDataset({
      name: 'test', description: '', owner: 'admin',
      tenantId: 'tenant-A', schema: [], classification: 'O',
      tags: [], lastUpdated: new Date().toISOString(),
    });
    expect(() => graph.addEdge(node.id, 'nonexistent', 'test')).toThrow();
    expect(() => graph.addEdge('nonexistent', node.id, 'test')).toThrow();
  });

  it('상위 계보를 추적한다', () => {
    const a = graph.addDataset({ name: 'A', description: '', owner: '', tenantId: 't', schema: [], classification: 'O', tags: [], lastUpdated: '' });
    const b = graph.addDataset({ name: 'B', description: '', owner: '', tenantId: 't', schema: [], classification: 'O', tags: [], lastUpdated: '' });
    const c = graph.addDataset({ name: 'C', description: '', owner: '', tenantId: 't', schema: [], classification: 'O', tags: [], lastUpdated: '' });
    graph.addEdge(a.id, b.id, 'A->B');
    graph.addEdge(b.id, c.id, 'B->C');

    const upstream = graph.getUpstream(c.id);
    expect(upstream).toHaveLength(2); // B, A
    expect(upstream.map((n) => n.name)).toContain('A');
    expect(upstream.map((n) => n.name)).toContain('B');
  });

  it('하위 영향도를 분석한다', () => {
    const a = graph.addDataset({ name: 'A', description: '', owner: '', tenantId: 't', schema: [], classification: 'O', tags: [], lastUpdated: '' });
    const b = graph.addDataset({ name: 'B', description: '', owner: '', tenantId: 't', schema: [], classification: 'O', tags: [], lastUpdated: '' });
    const c = graph.addDataset({ name: 'C', description: '', owner: '', tenantId: 't', schema: [], classification: 'O', tags: [], lastUpdated: '' });
    graph.addEdge(a.id, b.id, 'A->B');
    graph.addEdge(a.id, c.id, 'A->C');

    const downstream = graph.getDownstream(a.id);
    expect(downstream).toHaveLength(2); // B, C
  });

  it('테넌트별 데이터셋을 조회한다 (CSAP D-08)', () => {
    graph.addDataset({ name: 'A', description: '', owner: '', tenantId: 'tenant-A', schema: [], classification: 'O', tags: [], lastUpdated: '' });
    graph.addDataset({ name: 'B', description: '', owner: '', tenantId: 'tenant-B', schema: [], classification: 'O', tags: [], lastUpdated: '' });
    expect(graph.getByTenant('tenant-A')).toHaveLength(1);
  });

  it('데이터셋을 삭제하면 관련 엣지도 삭제', () => {
    const a = graph.addDataset({ name: 'A', description: '', owner: '', tenantId: 't', schema: [], classification: 'O', tags: [], lastUpdated: '' });
    const b = graph.addDataset({ name: 'B', description: '', owner: '', tenantId: 't', schema: [], classification: 'O', tags: [], lastUpdated: '' });
    graph.addEdge(a.id, b.id, 'A->B');

    graph.removeDataset(a.id);
    expect(graph.getAllDatasets()).toHaveLength(1);
    expect(graph.getAllEdges()).toHaveLength(0);
  });
});

// -- DataQualityEngine -- Design §2 ──────────────────────────────────────

describe('DataQualityEngine (FR-N261.2)', () => {
  let engine: DataQualityEngine;

  beforeEach(() => {
    engine = new DataQualityEngine();
  });

  it('품질 규칙을 추가한다', () => {
    const rule = engine.addRule({
      name: 'email_completeness',
      dimension: 'completeness',
      datasetId: 'ds-1',
      column: 'email',
      condition: 'NOT NULL',
      threshold: 0.95,
      severity: 'high',
      isActive: true,
    });
    expect(rule.id).toBeTruthy();
    expect(engine.getRules('ds-1')).toHaveLength(1);
  });

  it('completeness 검사: null 비율', () => {
    engine.addRule({
      name: 'email_completeness',
      dimension: 'completeness',
      datasetId: 'ds-1',
      column: 'email',
      condition: 'NOT NULL',
      threshold: 0.8,
      severity: 'high',
      isActive: true,
    });

    const data = [
      { email: 'a@test.com' },
      { email: 'b@test.com' },
      { email: null },
      { email: 'c@test.com' },
      { email: '' },
    ];

    const { results, overallScore } = engine.checkQuality('ds-1', data);
    expect(results).toHaveLength(1);
    // 5개 중 2개 null/빈값 → 60% 완전성 → threshold 80% 미달
    expect(results[0]!.passed).toBe(false);
  });

  it('모든 데이터 완전하면 통과', () => {
    engine.addRule({
      name: 'name_completeness',
      dimension: 'completeness',
      datasetId: 'ds-1',
      column: 'name',
      condition: 'NOT NULL',
      threshold: 0.9,
      severity: 'medium',
      isActive: true,
    });

    const data = [
      { name: 'Kim' },
      { name: 'Lee' },
      { name: 'Park' },
    ];

    const { results } = engine.checkQuality('ds-1', data);
    expect(results[0]!.passed).toBe(true);
  });

  it('규칙 없는 데이터셋은 점수 100', () => {
    const { overallScore } = engine.checkQuality('nonexistent', [{ a: 1 }]);
    expect(overallScore).toBe(100);
  });

  it('비활성 규칙은 무시', () => {
    engine.addRule({
      name: 'inactive_rule',
      dimension: 'accuracy',
      datasetId: 'ds-1',
      condition: 'test',
      threshold: 0.9,
      severity: 'low',
      isActive: false,
    });

    const { results } = engine.checkQuality('ds-1', [{ a: 1 }]);
    expect(results).toHaveLength(0);
  });

  it('규칙을 삭제한다', () => {
    const rule = engine.addRule({
      name: 'test',
      dimension: 'completeness',
      datasetId: 'ds-1',
      condition: '',
      threshold: 0.9,
      severity: 'medium',
      isActive: true,
    });
    expect(engine.removeRule(rule.id)).toBe(true);
    expect(engine.getRules('ds-1')).toHaveLength(0);
  });
});

// -- SensitiveDataClassifier -- Design §4 ──────────────────────────────────

describe('SensitiveDataClassifier (FR-N261.4)', () => {
  let classifier: SensitiveDataClassifier;

  beforeEach(() => {
    classifier = new SensitiveDataClassifier();
  });

  it('주민등록번호를 감지한다 (C등급)', () => {
    const results = classifier.classify('번호: 900101-1234567');
    expect(results.some((r) => r.piiType === 'RRN' && r.classification === 'C')).toBe(true);
  });

  it('이메일을 감지한다 (S등급)', () => {
    const results = classifier.classify('연락처: user@example.com');
    expect(results.some((r) => r.piiType === 'EMAIL' && r.classification === 'S')).toBe(true);
  });

  it('전화번호를 감지한다 (S등급)', () => {
    const results = classifier.classify('전화: 010-1234-5678');
    expect(results.some((r) => r.piiType === 'PHONE' && r.classification === 'S')).toBe(true);
  });

  it('IP 주소를 감지한다 (S등급)', () => {
    const results = classifier.classify('IP: 192.168.0.1');
    expect(results.some((r) => r.piiType === 'IP' && r.classification === 'S')).toBe(true);
  });

  it('민감 데이터 없으면 빈 배열', () => {
    const results = classifier.classify('일반적인 텍스트입니다.');
    expect(results).toHaveLength(0);
  });

  it('컬럼 자동 분류', () => {
    const data = [
      { name: '홍길동', email: 'hong@test.com', age: 30 },
      { name: '김철수', email: 'kim@test.com', age: 25 },
    ];
    const result = classifier.classifyColumns(data);
    expect(result['email']!.isSensitive).toBe(true);
    expect(result['name']!.isSensitive).toBe(false);
  });

  it('빈 데이터 컬럼 분류', () => {
    const result = classifier.classifyColumns([]);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// -- GovernancePolicyManager -- Design §6 ──────────────────────────────────

describe('GovernancePolicyManager (FR-N261.6)', () => {
  let manager: GovernancePolicyManager;

  beforeEach(() => {
    manager = new GovernancePolicyManager();
  });

  it('정책을 생성한다', () => {
    const policy = manager.create({
      name: '데이터 보존 정책',
      type: 'retention',
      description: '1년 보존',
      rules: { retentionDays: 365 },
      appliedTo: ['ds-1', 'ds-2'],
      isActive: true,
    });
    expect(policy.id).toBeTruthy();
    expect(manager.getAll()).toHaveLength(1);
  });

  it('ID로 정책을 조회한다', () => {
    const policy = manager.create({
      name: 'test', type: 'access', description: '',
      rules: {}, appliedTo: [], isActive: true,
    });
    expect(manager.get(policy.id)).toBeDefined();
    expect(manager.get('nonexistent')).toBeUndefined();
  });

  it('타입별 정책을 검색한다', () => {
    manager.create({
      name: 'access-1', type: 'access', description: '',
      rules: {}, appliedTo: [], isActive: true,
    });
    manager.create({
      name: 'retention-1', type: 'retention', description: '',
      rules: {}, appliedTo: [], isActive: true,
    });
    manager.create({
      name: 'access-2', type: 'access', description: '',
      rules: {}, appliedTo: [], isActive: false, // 비활성
    });

    expect(manager.getByType('access')).toHaveLength(1); // 활성만
    expect(manager.getByType('retention')).toHaveLength(1);
  });

  it('데이터셋에 적용된 정책을 검색한다', () => {
    manager.create({
      name: 'p1', type: 'access', description: '',
      rules: {}, appliedTo: ['ds-1', 'ds-2'], isActive: true,
    });
    manager.create({
      name: 'p2', type: 'masking', description: '',
      rules: {}, appliedTo: ['ds-2'], isActive: true,
    });

    expect(manager.getAppliedPolicies('ds-1')).toHaveLength(1);
    expect(manager.getAppliedPolicies('ds-2')).toHaveLength(2);
  });

  it('활성 정책 수를 반환한다', () => {
    manager.create({ name: 'a', type: 'access', description: '', rules: {}, appliedTo: [], isActive: true });
    manager.create({ name: 'b', type: 'access', description: '', rules: {}, appliedTo: [], isActive: false });
    manager.create({ name: 'c', type: 'access', description: '', rules: {}, appliedTo: [], isActive: true });
    expect(manager.getActiveCount()).toBe(2);
  });
});

// -- createDataGovernanceSuite 팩토리 ──────────────────────────────────────

describe('createDataGovernanceSuite 팩토리', () => {
  it('모든 컴포넌트를 생성한다', () => {
    const suite = createDataGovernanceSuite();
    expect(suite.lineage).toBeInstanceOf(DataLineageGraph);
    expect(suite.quality).toBeInstanceOf(DataQualityEngine);
    expect(suite.classifier).toBeInstanceOf(SensitiveDataClassifier);
    expect(suite.policyManager).toBeInstanceOf(GovernancePolicyManager);
  });
});

// -- getGovernanceMetrics ──────────────────────────────────────────────────

describe('getGovernanceMetrics', () => {
  it('거버넌스 메트릭을 집계한다', () => {
    const suite = createDataGovernanceSuite();
    suite.lineage.addDataset({
      name: 'users', description: '', owner: 'admin', tenantId: 't',
      schema: [
        { name: 'id', type: 'uuid', description: '', nullable: false, isSensitive: false },
        { name: 'email', type: 'string', description: '', nullable: false, isSensitive: true, piiType: 'EMAIL' },
      ],
      classification: 'S', tags: [], lastUpdated: '',
    });
    suite.lineage.addDataset({
      name: 'logs', description: '', owner: 'admin', tenantId: 't',
      schema: [{ name: 'msg', type: 'string', description: '', nullable: false, isSensitive: false }],
      classification: 'O', tags: [], lastUpdated: '',
    });
    suite.policyManager.create({
      name: 'test', type: 'access', description: '',
      rules: {}, appliedTo: [], isActive: true,
    });

    const metrics = getGovernanceMetrics(suite.lineage, suite.quality, suite.policyManager);
    expect(metrics.totalDatasets).toBe(2);
    expect(metrics.totalColumns).toBe(3);
    expect(metrics.sensitiveColumns).toBe(1);
    expect(metrics.classificationDistribution['S']).toBe(1);
    expect(metrics.classificationDistribution['O']).toBe(1);
    expect(metrics.policiesActive).toBe(1);
  });
});
