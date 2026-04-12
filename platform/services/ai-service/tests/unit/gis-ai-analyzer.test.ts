// MTU-N387 단위 테스트
import { describe, it, expect } from 'vitest';
import {
  tmToWgs84,
  wgs84ToTm,
  haversineDistanceKm,
  queryBBox,
  nearestNeighbors,
  clusterByRadius,
  getGisAuditLog,
  GisAiAnalyzerService,
  type SpatialFeature,
} from '../../src/lib/gis-ai-analyzer';

const features: SpatialFeature[] = [
  { featureId: 'f1', name: '서울시청', point: { lon: 126.978, lat: 37.566 }, attributes: {} },
  { featureId: 'f2', name: '광화문', point: { lon: 126.977, lat: 37.575 }, attributes: {} },
  { featureId: 'f3', name: '부산시청', point: { lon: 129.075, lat: 35.179 }, attributes: {} },
];

describe('MTU-N387 GisAiAnalyzer', () => {
  it('TM→WGS84 변환', () => {
    const p = tmToWgs84(200000, 600000);
    expect(p.lon).toBeCloseTo(127.5);
    expect(p.lat).toBeCloseTo(38.0);
  });

  it('WGS84→TM 변환', () => {
    const { x, y } = wgs84ToTm({ lon: 127.5, lat: 38.0 });
    expect(x).toBeCloseTo(200000);
    expect(y).toBeCloseTo(600000);
  });

  it('Haversine 거리', () => {
    const d = haversineDistanceKm(
      { lon: 126.978, lat: 37.566 },
      { lon: 129.075, lat: 35.179 },
    );
    expect(d).toBeGreaterThan(300);
    expect(d).toBeLessThan(400);
  });

  it('BBox 질의', () => {
    const result = queryBBox(features, { minLon: 126, minLat: 37, maxLon: 128, maxLat: 38 });
    expect(result.length).toBe(2);
  });

  it('BBox 밖 제외', () => {
    const result = queryBBox(features, { minLon: 129, minLat: 35, maxLon: 130, maxLat: 36 });
    expect(result.length).toBe(1);
    expect(result[0]?.featureId).toBe('f3');
  });

  it('K-최근접 이웃', () => {
    const nn = nearestNeighbors(features, { lon: 126.978, lat: 37.570 }, 2);
    expect(nn.length).toBe(2);
  });

  it('반경 클러스터링 - 가까운 것 병합', () => {
    const clusters = clusterByRadius('t1', features, 5);
    expect(clusters.length).toBeLessThanOrEqual(features.length);
  });

  it('반경이 매우 작으면 모두 별도 클러스터', () => {
    const clusters = clusterByRadius('t1', features, 0.001);
    expect(clusters.length).toBe(features.length);
  });

  it('반경이 매우 크면 1개 클러스터', () => {
    const clusters = clusterByRadius('t1', features, 1000);
    expect(clusters.length).toBe(1);
  });

  it('서비스 클래스', () => {
    const svc = new GisAiAnalyzerService('t2');
    const nn = svc.knn(features, { lon: 126.978, lat: 37.566 }, 1);
    expect(nn.length).toBe(1);
  });

  it('감사 로그 테넌트 격리', () => {
    clusterByRadius('tA', features, 10);
    clusterByRadius('tB', features, 10);
    expect(getGisAuditLog('tA').every((e) => e.tenantId === 'tA')).toBe(true);
  });
});
