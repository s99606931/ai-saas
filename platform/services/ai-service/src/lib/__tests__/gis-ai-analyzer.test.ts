// MTU-N387 GIS AI 분석 테스트
import { describe, it, expect } from 'vitest';
import { GisAiAnalyzerService, type SpatialFeature } from '../gis-ai-analyzer.js';

describe('MTU-N387 GisAiAnalyzer', () => {
  const svc = new GisAiAnalyzerService('tenant-n387');

  const features: SpatialFeature[] = [
    { featureId: 'f1', name: 'Seoul', point: { lon: 126.97, lat: 37.56 }, attributes: {} },
    { featureId: 'f2', name: 'Incheon', point: { lon: 126.7, lat: 37.45 }, attributes: {} },
    { featureId: 'f3', name: 'Busan', point: { lon: 129.07, lat: 35.17 }, attributes: {} },
  ];

  it('FR-N387.1: BBox 질의', () => {
    const result = svc.bbox(features, { minLon: 126, maxLon: 128, minLat: 37, maxLat: 38 });
    expect(result.length).toBe(2);
  });

  it('FR-N387.2: KNN 최근접', () => {
    const nearest = svc.knn(features, { lon: 126.97, lat: 37.56 }, 2);
    expect(nearest[0]?.featureId).toBe('f1');
  });

  it('FR-N387.3: 반경 클러스터링', () => {
    const clusters = svc.cluster(features, 50);
    expect(clusters.length).toBeGreaterThan(0);
  });

  it('FR-N387.4: 좌표 변환', () => {
    const wgs = svc.tmToWgs84(200000, 600000);
    expect(wgs.lon).toBeCloseTo(127.5, 1);
  });

  it('FR-N387.5: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
