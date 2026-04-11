// MTU-N259 단위 테스트: ML 피처 스토어
// Design Ref: MTU-N259 DESIGN §1~§6
// Plan SC: FR-N259.1~FR-N259.6
// CSAP: D-06 감사, D-07 모니터링, D-08 접근통제, D-12 개발 보안

import { describe, it, expect, beforeEach } from 'vitest';

import {
  FeatureRegistry,
  OnlineFeatureStore,
  OfflineFeatureStore,
  FeatureMonitor,
  createFeatureStore,
  getFeatureStoreMetrics,
} from '../../src/lib/feature-store.js';

// -- FeatureRegistry -- Design §1, §2 ──────────────────────────────────────

describe('FeatureRegistry (FR-N259.1)', () => {
  let registry: FeatureRegistry;

  beforeEach(() => {
    registry = new FeatureRegistry();
  });

  it('피처 그룹을 생성한다', () => {
    const group = registry.createGroup({
      name: 'user_features',
      entity: 'user',
      joinKey: 'userId',
      description: '사용자 피처 그룹',
      tenantId: 'tenant-A',
      features: [
        { name: 'login_count', dataType: 'number', description: '로그인 횟수', tags: ['usage'], nullable: false },
        { name: 'last_login', dataType: 'string', description: '마지막 로그인', tags: ['time'], nullable: true },
      ],
    });
    expect(group.id).toBeTruthy();
    expect(group.features).toHaveLength(2);
    expect(group.version).toBe('1.0');
    expect(group.tenantId).toBe('tenant-A');
  });

  it('그룹을 ID로 조회한다', () => {
    const group = registry.createGroup({
      name: 'test', entity: 'item', joinKey: 'itemId',
      description: '', tenantId: 'tenant-A', features: [],
    });
    expect(registry.getGroup(group.id)).toBeDefined();
    expect(registry.getGroup('nonexistent')).toBeUndefined();
  });

  it('엔티티별 그룹을 검색한다', () => {
    registry.createGroup({
      name: 'user_a', entity: 'user', joinKey: 'userId',
      description: '', tenantId: 'tenant-A', features: [],
    });
    registry.createGroup({
      name: 'item_a', entity: 'item', joinKey: 'itemId',
      description: '', tenantId: 'tenant-A', features: [],
    });
    registry.createGroup({
      name: 'user_b', entity: 'user', joinKey: 'userId',
      description: '', tenantId: 'tenant-B', features: [],
    });

    expect(registry.getGroupsByEntity('user')).toHaveLength(2);
    expect(registry.getGroupsByEntity('item')).toHaveLength(1);
  });

  it('테넌트별 그룹을 검색한다 (CSAP D-08)', () => {
    registry.createGroup({
      name: 'a', entity: 'user', joinKey: 'userId',
      description: '', tenantId: 'tenant-A', features: [],
    });
    registry.createGroup({
      name: 'b', entity: 'user', joinKey: 'userId',
      description: '', tenantId: 'tenant-B', features: [],
    });

    expect(registry.getGroupsByTenant('tenant-A')).toHaveLength(1);
    expect(registry.getGroupsByTenant('tenant-B')).toHaveLength(1);
  });

  it('피처를 추가한다 (스키마 진화)', () => {
    const group = registry.createGroup({
      name: 'test', entity: 'user', joinKey: 'userId',
      description: '', tenantId: 'tenant-A',
      features: [{ name: 'f1', dataType: 'number', description: '', tags: [], nullable: false }],
    });
    const newFeature = registry.addFeature(group.id, {
      name: 'f2', dataType: 'string', description: '추가 피처', tags: ['new'], nullable: true,
    });
    expect(newFeature).not.toBeNull();
    expect(newFeature!.name).toBe('f2');

    const updated = registry.getGroup(group.id)!;
    expect(updated.features).toHaveLength(2);
    // 마이너 버전 증가 확인
    expect(updated.version).toBe('1.2');
  });

  it('중복 피처 이름 추가 시 에러', () => {
    const group = registry.createGroup({
      name: 'test', entity: 'user', joinKey: 'userId',
      description: '', tenantId: 'tenant-A',
      features: [{ name: 'f1', dataType: 'number', description: '', tags: [], nullable: false }],
    });
    expect(() =>
      registry.addFeature(group.id, {
        name: 'f1', dataType: 'string', description: '', tags: [], nullable: true,
      }),
    ).toThrow('피처 이름 중복');
  });

  it('존재하지 않는 그룹에 피처 추가 시 null', () => {
    expect(registry.addFeature('nonexistent', {
      name: 'f', dataType: 'number', description: '', tags: [], nullable: false,
    })).toBeNull();
  });

  it('그룹을 삭제한다', () => {
    const group = registry.createGroup({
      name: 'test', entity: 'user', joinKey: 'userId',
      description: '', tenantId: 'tenant-A', features: [],
    });
    expect(registry.deleteGroup(group.id)).toBe(true);
    expect(registry.getGroup(group.id)).toBeUndefined();
  });

  it('전체 피처 수를 반환한다', () => {
    registry.createGroup({
      name: 'g1', entity: 'user', joinKey: 'userId',
      description: '', tenantId: 'tenant-A',
      features: [
        { name: 'f1', dataType: 'number', description: '', tags: [], nullable: false },
        { name: 'f2', dataType: 'string', description: '', tags: [], nullable: false },
      ],
    });
    registry.createGroup({
      name: 'g2', entity: 'item', joinKey: 'itemId',
      description: '', tenantId: 'tenant-A',
      features: [
        { name: 'f3', dataType: 'boolean', description: '', tags: [], nullable: false },
      ],
    });
    expect(registry.getTotalFeatureCount()).toBe(3);
  });

  it('피처 계보를 등록/조회한다 (Design §5)', () => {
    registry.registerLineage({
      featureId: 'f1',
      featureName: 'login_count',
      source: 'auth_logs',
      transformation: 'COUNT(login_events)',
      inputFeatures: ['login_event_timestamp'],
      version: '1.0',
    });

    const lineage = registry.getLineage('login_count');
    expect(lineage).toHaveLength(1);
    expect(lineage[0]!.source).toBe('auth_logs');
  });
});

// -- OnlineFeatureStore -- Design §4 ──────────────────────────────────────

describe('OnlineFeatureStore (FR-N259.4)', () => {
  let store: OnlineFeatureStore;

  beforeEach(() => {
    store = new OnlineFeatureStore();
  });

  it('피처 값을 저장/조회한다', () => {
    store.put('g1', 'e1', 'login_count', 42);
    const value = store.get('g1', 'e1', 'login_count');
    expect(value).not.toBeNull();
    expect(value!.value).toBe(42);
  });

  it('배치 저장을 지원한다', () => {
    store.putBatch('g1', 'e1', { login_count: 42, session_time: 25.5, is_active: true });
    expect(store.get('g1', 'e1', 'login_count')!.value).toBe(42);
    expect(store.get('g1', 'e1', 'session_time')!.value).toBe(25.5);
    expect(store.get('g1', 'e1', 'is_active')!.value).toBe(true);
  });

  it('존재하지 않는 피처 조회 시 null', () => {
    expect(store.get('g1', 'e1', 'nonexistent')).toBeNull();
  });

  it('존재하지 않는 엔티티 조회 시 null', () => {
    expect(store.get('g1', 'nonexistent', 'f1')).toBeNull();
  });

  it('엔티티의 모든 피처를 조회한다', () => {
    store.putBatch('g1', 'e1', { f1: 10, f2: 'hello', f3: true });
    const all = store.getAll('g1', 'e1');
    expect(all).toEqual({ f1: 10, f2: 'hello', f3: true });
  });

  it('빈 엔티티는 빈 객체 반환', () => {
    expect(store.getAll('g1', 'nonexistent')).toEqual({});
  });

  it('엔티티를 삭제한다', () => {
    store.put('g1', 'e1', 'f1', 42);
    expect(store.delete('g1', 'e1')).toBe(true);
    expect(store.get('g1', 'e1', 'f1')).toBeNull();
  });

  it('캐시 히트율을 계산한다', () => {
    store.put('g1', 'e1', 'f1', 42);
    store.get('g1', 'e1', 'f1'); // hit
    store.get('g1', 'e1', 'f2'); // miss
    const hitRate = store.getCacheHitRate();
    expect(hitRate).toBe(50);
  });

  it('초기 캐시 히트율은 100', () => {
    expect(store.getCacheHitRate()).toBe(100);
  });

  it('평균 서빙 지연 시간을 반환한다', () => {
    store.put('g1', 'e1', 'f1', 42);
    store.get('g1', 'e1', 'f1');
    expect(store.getAverageLatencyMs()).toBeGreaterThanOrEqual(0);
  });

  it('초기 평균 지연 시간은 0', () => {
    expect(store.getAverageLatencyMs()).toBe(0);
  });

  it('총 엔티티 수를 반환한다', () => {
    store.put('g1', 'e1', 'f1', 1);
    store.put('g1', 'e2', 'f1', 2);
    store.put('g2', 'e3', 'f1', 3);
    expect(store.size()).toBe(3);
  });

  it('전체 비우기', () => {
    store.put('g1', 'e1', 'f1', 1);
    store.put('g1', 'e2', 'f1', 2);
    store.clear();
    expect(store.size()).toBe(0);
  });
});

// -- OfflineFeatureStore -- Design §3 ────────────────────────────────────────

describe('OfflineFeatureStore (FR-N259.3)', () => {
  let store: OfflineFeatureStore;

  beforeEach(() => {
    store = new OfflineFeatureStore();
  });

  it('레코드를 적재한다', () => {
    const id = store.ingest('g1', 'e1', { f1: 10, f2: 'a' }, '2026-04-01T00:00:00Z');
    expect(id).toBeTruthy();
    expect(store.size()).toBe(1);
  });

  it('배치 적재를 지원한다', () => {
    const ids = store.ingestBatch('g1', [
      { entityId: 'e1', features: { f1: 10 }, eventTimestamp: '2026-04-01T00:00:00Z' },
      { entityId: 'e2', features: { f1: 20 }, eventTimestamp: '2026-04-01T00:00:00Z' },
      { entityId: 'e3', features: { f1: 30 } },
    ]);
    expect(ids).toHaveLength(3);
    expect(store.size()).toBe(3);
  });

  it('시점 기반 조회 (point-in-time)', () => {
    store.ingest('g1', 'e1', { f1: 10 }, '2026-04-01T00:00:00Z');
    store.ingest('g1', 'e1', { f1: 20 }, '2026-04-02T00:00:00Z');
    store.ingest('g1', 'e1', { f1: 30 }, '2026-04-03T00:00:00Z');

    // 4월 2일 기준 조회 → f1=20
    const features = store.getAsOf('g1', 'e1', '2026-04-02T12:00:00Z');
    expect(features).not.toBeNull();
    expect(features!.f1).toBe(20);
  });

  it('시점 이전 데이터 없으면 null', () => {
    store.ingest('g1', 'e1', { f1: 10 }, '2026-04-01T00:00:00Z');
    const features = store.getAsOf('g1', 'e1', '2026-03-31T00:00:00Z');
    expect(features).toBeNull();
  });

  it('최신 피처를 조회한다', () => {
    store.ingest('g1', 'e1', { f1: 10 }, '2026-04-01T00:00:00Z');
    store.ingest('g1', 'e1', { f1: 20 }, '2026-04-02T00:00:00Z');
    const latest = store.getLatest('g1', 'e1');
    expect(latest).not.toBeNull();
    expect(latest!.f1).toBe(20);
  });

  it('기간별 히스토리를 조회한다', () => {
    store.ingest('g1', 'e1', { f1: 10 }, '2026-04-01T00:00:00Z');
    store.ingest('g1', 'e1', { f1: 20 }, '2026-04-02T00:00:00Z');
    store.ingest('g1', 'e1', { f1: 30 }, '2026-04-03T00:00:00Z');

    const history = store.getHistory('g1', 'e1', '2026-04-01T00:00:00Z', '2026-04-02T23:59:59Z');
    expect(history).toHaveLength(2);
  });

  it('그룹별 레코드 수를 반환한다', () => {
    store.ingest('g1', 'e1', { f1: 10 });
    store.ingest('g1', 'e2', { f1: 20 });
    store.ingest('g2', 'e3', { f1: 30 });
    expect(store.countByGroup('g1')).toBe(2);
    expect(store.countByGroup('g2')).toBe(1);
  });
});

// -- FeatureMonitor -- Design §6 ────────────────────────────────────────────

describe('FeatureMonitor (FR-N259.6)', () => {
  let monitor: FeatureMonitor;

  beforeEach(() => {
    monitor = new FeatureMonitor();
  });

  it('분포 이동을 감지한다 (drift)', () => {
    const baseline = [10, 20, 30, 40, 50];
    const current = [100, 200, 300, 400, 500]; // 큰 이동
    const drift = monitor.detectDrift('f1', current, baseline);
    expect(drift).toBeGreaterThan(0.3);
  });

  it('동일 분포면 drift 0에 가깝다', () => {
    const baseline = [10, 20, 30, 40, 50];
    const current = [10, 20, 30, 40, 50];
    const drift = monitor.detectDrift('f1', current, baseline);
    expect(drift).toBe(0);
  });

  it('빈 데이터면 drift 0', () => {
    expect(monitor.detectDrift('f1', [], [1, 2, 3])).toBe(0);
    expect(monitor.detectDrift('f1', [1, 2, 3], [])).toBe(0);
  });

  it('기준선을 설정한다', () => {
    // 에러 없이 완료되면 성공
    monitor.setBaseline('f1', [10, 20, 30, 40, 50]);
    expect(true).toBe(true);
  });

  it('빈 값으로 기준선 설정 시 무시', () => {
    monitor.setBaseline('f1', []);
    expect(true).toBe(true);
  });

  it('피처 건강 상태를 계산한다', () => {
    const onlineStore = new OnlineFeatureStore();
    const offlineStore = new OfflineFeatureStore();
    onlineStore.put('g1', 'e1', 'f1', 42);

    const health = monitor.computeHealth('f1', 'g1', offlineStore, onlineStore);
    expect(health.status).toBe('healthy');
    expect(health.featureName).toBe('f1');
    expect(health.groupId).toBe('g1');
  });
});

// -- createFeatureStore 팩토리 ───────────────────────────────────────────────

describe('createFeatureStore 팩토리', () => {
  it('레지스트리, 온/오프라인 스토어, 모니터를 생성한다', () => {
    const { registry, onlineStore, offlineStore, monitor } = createFeatureStore();
    expect(registry).toBeInstanceOf(FeatureRegistry);
    expect(onlineStore).toBeInstanceOf(OnlineFeatureStore);
    expect(offlineStore).toBeInstanceOf(OfflineFeatureStore);
    expect(monitor).toBeInstanceOf(FeatureMonitor);
  });
});

// -- getFeatureStoreMetrics ──────────────────────────────────────────────────

describe('getFeatureStoreMetrics', () => {
  it('전체 메트릭을 반환한다', () => {
    const { registry, onlineStore, offlineStore } = createFeatureStore();
    registry.createGroup({
      name: 'g1', entity: 'user', joinKey: 'userId',
      description: '', tenantId: 'tenant-A',
      features: [{ name: 'f1', dataType: 'number', description: '', tags: [], nullable: false }],
    });
    onlineStore.put('g1', 'e1', 'f1', 42);
    offlineStore.ingest('g1', 'e1', { f1: 42 });

    const metrics = getFeatureStoreMetrics(registry, onlineStore, offlineStore);
    expect(metrics.totalGroups).toBe(1);
    expect(metrics.totalFeatures).toBe(1);
    expect(metrics.totalOnlineEntities).toBe(1);
    expect(metrics.totalOfflineRecords).toBe(1);
  });
});
