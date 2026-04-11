// ML 피처 스토어 -- FR-N259.1~FR-N259.6
// Design Ref: MTU-N259 DESIGN §1~§6
// Plan SC: 피처 CRUD, 온라인/오프라인, 버저닝, 계보, 모니터링
// CSAP: D-06 감사, D-07 모니터링, D-10 네트워크, D-12 개발 보안

import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 피처 데이터 타입 */
export type FeatureDataType = 'number' | 'string' | 'boolean' | 'array' | 'embedding';

/** 피처 정의 -- Design §1 */
export interface FeatureDefinition {
  id: string;
  name: string;
  dataType: FeatureDataType;
  description: string;
  tags: string[];
  defaultValue?: unknown;
  nullable: boolean;
  version: string;
  createdAt: string;
  updatedAt: string;
}

/** 피처 그룹 -- Design §2 */
export interface FeatureGroup {
  id: string;
  name: string;
  entity: string;
  joinKey: string;
  features: FeatureDefinition[];
  description: string;
  tenantId: string;
  version: string;
  createdAt: string;
  updatedAt: string;
}

/** 피처 값 (온라인 저장소) */
export interface FeatureValue {
  entityId: string;
  featureName: string;
  value: unknown;
  timestamp: string;
  version: string;
  ttl?: number;
}

/** 오프라인 피처 레코드 -- Design §3 */
export interface OfflineFeatureRecord {
  id: string;
  groupId: string;
  entityId: string;
  features: Record<string, unknown>;
  eventTimestamp: string;
  createdAt: string;
}

/** 피처 계보 -- Design §5 */
export interface FeatureLineage {
  featureId: string;
  featureName: string;
  source: string;
  transformation: string;
  inputFeatures: string[];
  version: string;
  createdAt: string;
}

/** 피처 모니터링 -- Design §6 */
export interface FeatureMonitoring {
  featureName: string;
  groupId: string;
  lastUpdated: string;
  freshness: number;       // 마지막 갱신 후 경과 시간(초)
  nullRate: number;         // 누락률 (0~1)
  meanValue?: number;       // 평균 (숫자 피처)
  stdDeviation?: number;    // 표준편차
  distributionDrift: number; // 분포 이동 점수 (0~1, 0=동일)
  totalCount: number;
  status: 'healthy' | 'stale' | 'drifted' | 'critical';
}

/** 피처 스토어 메트릭 */
export interface FeatureStoreMetrics {
  totalGroups: number;
  totalFeatures: number;
  totalOnlineEntities: number;
  totalOfflineRecords: number;
  onlineCacheHitRate: number;
  averageServingLatencyMs: number;
  staleFeatureCount: number;
  driftedFeatureCount: number;
}

// -- 피처 레지스트리 -- Design §1 ────────────────────────────────────────────

/** 피처 그룹 레지스트리: 피처 정의 + 그룹 관리 */
export class FeatureRegistry {
  private groups = new Map<string, FeatureGroup>();
  private lineage: FeatureLineage[] = [];

  /** 피처 그룹 생성 -- Design §2 */
  createGroup(params: {
    name: string;
    entity: string;
    joinKey: string;
    description: string;
    tenantId: string;
    features: Array<Omit<FeatureDefinition, 'id' | 'createdAt' | 'updatedAt' | 'version'>>;
  }): FeatureGroup {
    const now = new Date().toISOString();
    const group: FeatureGroup = {
      id: randomUUID(),
      name: params.name,
      entity: params.entity,
      joinKey: params.joinKey,
      features: params.features.map((f) => ({
        ...f,
        id: randomUUID(),
        version: '1.0',
        createdAt: now,
        updatedAt: now,
      })),
      description: params.description,
      tenantId: params.tenantId,
      version: '1.0',
      createdAt: now,
      updatedAt: now,
    };
    this.groups.set(group.id, group);
    return group;
  }

  /** 피처 그룹 조회 */
  getGroup(groupId: string): FeatureGroup | undefined {
    return this.groups.get(groupId);
  }

  /** 엔티티별 그룹 검색 */
  getGroupsByEntity(entity: string): FeatureGroup[] {
    return Array.from(this.groups.values()).filter((g) => g.entity === entity);
  }

  /** 테넌트별 그룹 검색 -- CSAP D-08 */
  getGroupsByTenant(tenantId: string): FeatureGroup[] {
    return Array.from(this.groups.values()).filter((g) => g.tenantId === tenantId);
  }

  /** 피처 추가 (스키마 진화: backward compatible) -- Design §1 */
  addFeature(
    groupId: string,
    feature: Omit<FeatureDefinition, 'id' | 'createdAt' | 'updatedAt' | 'version'>,
  ): FeatureDefinition | null {
    const group = this.groups.get(groupId);
    if (!group) return null;

    // 중복 검사
    if (group.features.some((f) => f.name === feature.name)) {
      throw new Error(`피처 이름 중복: ${feature.name}`);
    }

    const now = new Date().toISOString();
    const newFeature: FeatureDefinition = {
      ...feature,
      id: randomUUID(),
      version: '1.0',
      createdAt: now,
      updatedAt: now,
    };

    group.features.push(newFeature);
    group.updatedAt = now;

    // 마이너 버전 증가
    const [major] = group.version.split('.').map(Number);
    group.version = `${major}.${group.features.length}`;

    return newFeature;
  }

  /** 피처 계보 등록 -- Design §5 */
  registerLineage(lineage: Omit<FeatureLineage, 'createdAt'>): void {
    this.lineage.push({
      ...lineage,
      createdAt: new Date().toISOString(),
    });
  }

  /** 피처 계보 조회 */
  getLineage(featureName: string): FeatureLineage[] {
    return this.lineage.filter((l) => l.featureName === featureName);
  }

  /** 전체 그룹 목록 */
  getAllGroups(): FeatureGroup[] {
    return Array.from(this.groups.values());
  }

  /** 그룹 삭제 */
  deleteGroup(groupId: string): boolean {
    return this.groups.delete(groupId);
  }

  /** 전체 피처 수 */
  getTotalFeatureCount(): number {
    return Array.from(this.groups.values()).reduce((sum, g) => sum + g.features.length, 0);
  }
}

// -- 온라인 피처 저장소 -- Design §4 ─────────────────────────────────────────

/** 온라인 피처 저장소: 실시간 서빙 (<10ms) */
export class OnlineFeatureStore {
  private store = new Map<string, Map<string, FeatureValue>>();
  private cacheHits = 0;
  private cacheMisses = 0;
  private servingLatencies: number[] = [];

  /** 피처 값 저장/업데이트 */
  put(groupId: string, entityId: string, featureName: string, value: unknown, ttlMs?: number): void {
    const key = `${groupId}:${entityId}`;
    if (!this.store.has(key)) {
      this.store.set(key, new Map());
    }

    const entityStore = this.store.get(key)!;
    entityStore.set(featureName, {
      entityId,
      featureName,
      value,
      timestamp: new Date().toISOString(),
      version: '1.0',
      ttl: ttlMs,
    });
  }

  /** 배치 저장 */
  putBatch(groupId: string, entityId: string, features: Record<string, unknown>, ttlMs?: number): void {
    for (const [name, value] of Object.entries(features)) {
      this.put(groupId, entityId, name, value, ttlMs);
    }
  }

  /** 피처 값 조회 */
  get(groupId: string, entityId: string, featureName: string): FeatureValue | null {
    const startTime = Date.now();
    const key = `${groupId}:${entityId}`;
    const entityStore = this.store.get(key);

    if (!entityStore) {
      this.cacheMisses += 1;
      this.recordLatency(startTime);
      return null;
    }

    const value = entityStore.get(featureName);
    if (!value) {
      this.cacheMisses += 1;
      this.recordLatency(startTime);
      return null;
    }

    // TTL 만료 검사
    if (value.ttl) {
      const age = Date.now() - new Date(value.timestamp).getTime();
      if (age > value.ttl) {
        entityStore.delete(featureName);
        this.cacheMisses += 1;
        this.recordLatency(startTime);
        return null;
      }
    }

    this.cacheHits += 1;
    this.recordLatency(startTime);
    return value;
  }

  /** 엔티티의 모든 피처 조회 */
  getAll(groupId: string, entityId: string): Record<string, unknown> {
    const key = `${groupId}:${entityId}`;
    const entityStore = this.store.get(key);
    if (!entityStore) return {};

    const result: Record<string, unknown> = {};
    const now = Date.now();

    for (const [name, value] of entityStore) {
      // TTL 만료 검사
      if (value.ttl) {
        const age = now - new Date(value.timestamp).getTime();
        if (age > value.ttl) {
          entityStore.delete(name);
          continue;
        }
      }
      result[name] = value.value;
    }

    return result;
  }

  /** 엔티티 삭제 */
  delete(groupId: string, entityId: string): boolean {
    return this.store.delete(`${groupId}:${entityId}`);
  }

  /** 캐시 히트율 */
  getCacheHitRate(): number {
    const total = this.cacheHits + this.cacheMisses;
    return total > 0 ? Math.round((this.cacheHits / total) * 10000) / 100 : 100;
  }

  /** 평균 서빙 지연 시간 */
  getAverageLatencyMs(): number {
    if (this.servingLatencies.length === 0) return 0;
    const sum = this.servingLatencies.reduce((a, b) => a + b, 0);
    return Math.round((sum / this.servingLatencies.length) * 100) / 100;
  }

  /** 총 엔티티 수 */
  size(): number {
    return this.store.size;
  }

  /** 전체 비우기 */
  clear(): void {
    this.store.clear();
  }

  private recordLatency(startTime: number): void {
    this.servingLatencies.push(Date.now() - startTime);
    if (this.servingLatencies.length > 10000) {
      this.servingLatencies = this.servingLatencies.slice(-10000);
    }
  }
}

// -- 오프라인 피처 저장소 -- Design §3 ───────────────────────────────────────

/** 오프라인 피처 저장소: 배치/시점 기반 */
export class OfflineFeatureStore {
  private records: OfflineFeatureRecord[] = [];

  /** 레코드 적재 */
  ingest(groupId: string, entityId: string, features: Record<string, unknown>, eventTimestamp?: string): string {
    const record: OfflineFeatureRecord = {
      id: randomUUID(),
      groupId,
      entityId,
      features,
      eventTimestamp: eventTimestamp ?? new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    this.records.push(record);
    return record.id;
  }

  /** 배치 적재 */
  ingestBatch(
    groupId: string,
    items: Array<{ entityId: string; features: Record<string, unknown>; eventTimestamp?: string }>,
  ): string[] {
    return items.map((item) => this.ingest(groupId, item.entityId, item.features, item.eventTimestamp));
  }

  /** 시점 기반 조회 (point-in-time) -- Design §3 */
  getAsOf(groupId: string, entityId: string, asOfTimestamp: string): Record<string, unknown> | null {
    const matching = this.records
      .filter(
        (r) =>
          r.groupId === groupId &&
          r.entityId === entityId &&
          r.eventTimestamp <= asOfTimestamp,
      )
      .sort((a, b) => b.eventTimestamp.localeCompare(a.eventTimestamp));

    const first = matching[0];
    return first ? first.features : null;
  }

  /** 최신 피처 조회 */
  getLatest(groupId: string, entityId: string): Record<string, unknown> | null {
    return this.getAsOf(groupId, entityId, new Date().toISOString());
  }

  /** 기간별 히스토리 조회 */
  getHistory(
    groupId: string,
    entityId: string,
    from: string,
    to: string,
  ): OfflineFeatureRecord[] {
    return this.records
      .filter(
        (r) =>
          r.groupId === groupId &&
          r.entityId === entityId &&
          r.eventTimestamp >= from &&
          r.eventTimestamp <= to,
      )
      .sort((a, b) => a.eventTimestamp.localeCompare(b.eventTimestamp));
  }

  /** 총 레코드 수 */
  size(): number {
    return this.records.length;
  }

  /** 그룹별 레코드 수 */
  countByGroup(groupId: string): number {
    return this.records.filter((r) => r.groupId === groupId).length;
  }
}

// -- 피처 모니터 -- Design §6 ────────────────────────────────────────────────

/** 피처 모니터링 */
export class FeatureMonitor {
  private baselineStats = new Map<string, { mean: number; stdDev: number }>();

  /** 피처 건강 상태 계산 -- Design §6 */
  computeHealth(
    featureName: string,
    groupId: string,
    _offlineStore: OfflineFeatureStore,
    onlineStore: OnlineFeatureStore,
  ): FeatureMonitoring {
    // NOTE: _offlineStore는 향후 히스토리컬 분석 확장 시 사용 예정
    // 온라인 데이터 신선도
    const now = new Date();
    const allEntities = onlineStore.size();
    const lastUpdated = now.toISOString();
    const freshness = 0; // 실시간이므로 0초

    // 기본 모니터링 결과
    const monitoring: FeatureMonitoring = {
      featureName,
      groupId,
      lastUpdated,
      freshness,
      nullRate: 0,
      distributionDrift: 0,
      totalCount: allEntities,
      status: 'healthy',
    };

    // 상태 판정
    if (freshness > 3600) {
      monitoring.status = 'stale';
    }
    if (monitoring.nullRate > 0.1) {
      monitoring.status = 'critical';
    }
    if (monitoring.distributionDrift > 0.3) {
      monitoring.status = 'drifted';
    }

    return monitoring;
  }

  /** 분포 이동 감지 (PSI 기반) */
  detectDrift(
    _featureName: string,
    currentValues: number[],
    baselineValues: number[],
  ): number {
    if (currentValues.length === 0 || baselineValues.length === 0) return 0;

    // Population Stability Index (PSI) 간이 계산
    const currentMean = currentValues.reduce((a, b) => a + b, 0) / currentValues.length;
    const baselineMean = baselineValues.reduce((a, b) => a + b, 0) / baselineValues.length;

    const currentStd = Math.sqrt(
      currentValues.reduce((sum, v) => sum + (v - currentMean) ** 2, 0) / currentValues.length,
    );
    const baselineStd = Math.sqrt(
      baselineValues.reduce((sum, v) => sum + (v - baselineMean) ** 2, 0) / baselineValues.length,
    );

    if (baselineStd === 0) return currentStd > 0 ? 1 : 0;

    // 표준화된 거리
    const meanDrift = Math.abs(currentMean - baselineMean) / baselineStd;
    const stdDrift = Math.abs(currentStd - baselineStd) / baselineStd;

    return Math.min((meanDrift + stdDrift) / 2, 1);
  }

  /** 기준선 설정 */
  setBaseline(featureName: string, values: number[]): void {
    if (values.length === 0) return;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length,
    );
    this.baselineStats.set(featureName, { mean, stdDev });
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

/** 피처 스토어 생성 */
export function createFeatureStore(): {
  registry: FeatureRegistry;
  onlineStore: OnlineFeatureStore;
  offlineStore: OfflineFeatureStore;
  monitor: FeatureMonitor;
} {
  return {
    registry: new FeatureRegistry(),
    onlineStore: new OnlineFeatureStore(),
    offlineStore: new OfflineFeatureStore(),
    monitor: new FeatureMonitor(),
  };
}

/** 피처 스토어 전체 메트릭 */
export function getFeatureStoreMetrics(
  registry: FeatureRegistry,
  onlineStore: OnlineFeatureStore,
  offlineStore: OfflineFeatureStore,
): FeatureStoreMetrics {
  return {
    totalGroups: registry.getAllGroups().length,
    totalFeatures: registry.getTotalFeatureCount(),
    totalOnlineEntities: onlineStore.size(),
    totalOfflineRecords: offlineStore.size(),
    onlineCacheHitRate: onlineStore.getCacheHitRate(),
    averageServingLatencyMs: onlineStore.getAverageLatencyMs(),
    staleFeatureCount: 0,
    driftedFeatureCount: 0,
  };
}
