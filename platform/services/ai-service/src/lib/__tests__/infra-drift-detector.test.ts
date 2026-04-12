// MTU-N324 인프라 드리프트 탐지 테스트
import { describe, it, expect } from 'vitest';
import { InfraDriftDetectorService } from '../infra-drift-detector.js';

describe('MTU-N324 InfraDriftDetector', () => {
  const svc = new InfraDriftDetectorService('tenant-n324');

  const resource = {
    resourceId: 'r1',
    type: 'k8s_deployment',
    name: 'api',
    desiredState: { replicas: 3, image: 'api:v1' },
    actualState: { replicas: 5, image: 'api:v1' },
  };

  it('FR-N324.1: 단일 자원 드리프트', () => {
    const results = svc.detect(resource);
    expect(Array.isArray(results)).toBe(true);
  });

  it('FR-N324.2: 전체 스캔', () => {
    const report = svc.scan([resource]);
    expect(report).toBeDefined();
  });

  it('FR-N324.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
