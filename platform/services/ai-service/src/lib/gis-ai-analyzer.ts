// 국가 공간정보 GIS AI 분석 -- FR-N387.1~FR-N387.5
// Design Ref: MTU-N387 | CSAP: D-08

export interface Point {
  readonly lon: number;
  readonly lat: number;
}

export interface SpatialFeature {
  readonly featureId: string;
  readonly name: string;
  readonly point: Point;
  readonly attributes: Record<string, string | number>;
}

export interface BBox {
  readonly minLon: number;
  readonly minLat: number;
  readonly maxLon: number;
  readonly maxLat: number;
}

export interface Cluster {
  readonly clusterId: number;
  readonly center: Point;
  readonly memberIds: readonly string[];
}

export interface GisAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

const auditLog: GisAuditEntry[] = [];

function recordAudit(entry: Omit<GisAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getGisAuditLog(tenantId: string): readonly GisAuditEntry[] {
  return auditLog.filter((e) => e.tenantId === tenantId);
}

// EPSG:5179 (TM) ↔ EPSG:4326 (WGS84) 근사 변환
// 실제 프로덕션에서는 proj4 라이브러리 사용 권장
export function tmToWgs84(x: number, y: number): Point {
  // 한국 중부원점 근사 변환 (단순화)
  const lon = (x - 200000) / 96486 + 127.5;
  const lat = (y - 600000) / 111319 + 38.0;
  return { lon, lat };
}

export function wgs84ToTm(point: Point): { x: number; y: number } {
  const x = (point.lon - 127.5) * 96486 + 200000;
  const y = (point.lat - 38.0) * 111319 + 600000;
  return { x, y };
}

export function haversineDistanceKm(a: Point, b: Point): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function queryBBox(features: readonly SpatialFeature[], bbox: BBox): readonly SpatialFeature[] {
  return features.filter(
    (f) =>
      f.point.lon >= bbox.minLon &&
      f.point.lon <= bbox.maxLon &&
      f.point.lat >= bbox.minLat &&
      f.point.lat <= bbox.maxLat,
  );
}

export function nearestNeighbors(
  features: readonly SpatialFeature[],
  target: Point,
  k: number,
): readonly SpatialFeature[] {
  const withDist = features.map((f) => ({ f, d: haversineDistanceKm(f.point, target) }));
  withDist.sort((a, b) => a.d - b.d);
  return withDist.slice(0, k).map((x) => x.f);
}

export function clusterByRadius(
  tenantId: string,
  features: readonly SpatialFeature[],
  radiusKm: number,
): readonly Cluster[] {
  const assigned = new Set<string>();
  const clusters: Cluster[] = [];
  let cid = 0;
  for (const f of features) {
    if (assigned.has(f.featureId)) continue;
    const members: SpatialFeature[] = [f];
    assigned.add(f.featureId);
    for (const other of features) {
      if (assigned.has(other.featureId)) continue;
      if (haversineDistanceKm(f.point, other.point) <= radiusKm) {
        members.push(other);
        assigned.add(other.featureId);
      }
    }
    const avgLon = members.reduce((s, m) => s + m.point.lon, 0) / members.length;
    const avgLat = members.reduce((s, m) => s + m.point.lat, 0) / members.length;
    clusters.push({
      clusterId: cid++,
      center: { lon: avgLon, lat: avgLat },
      memberIds: members.map((m) => m.featureId),
    });
  }
  recordAudit({
    actor: 'system',
    tenantId,
    action: 'CLUSTER_COMPUTED',
    target: 'features',
    details: { featureCount: features.length, clusterCount: clusters.length, radiusKm },
  });
  return clusters;
}

export class GisAiAnalyzerService {
  constructor(private readonly tenantId: string) {}
  tmToWgs84(x: number, y: number): Point {
    return tmToWgs84(x, y);
  }
  wgs84ToTm(p: Point): { x: number; y: number } {
    return wgs84ToTm(p);
  }
  bbox(features: readonly SpatialFeature[], bbox: BBox): readonly SpatialFeature[] {
    return queryBBox(features, bbox);
  }
  knn(features: readonly SpatialFeature[], target: Point, k: number): readonly SpatialFeature[] {
    return nearestNeighbors(features, target, k);
  }
  cluster(features: readonly SpatialFeature[], radiusKm: number): readonly Cluster[] {
    return clusterByRadius(this.tenantId, features, radiusKm);
  }
  getAuditLog(): readonly GisAuditEntry[] {
    return getGisAuditLog(this.tenantId);
  }
}
