// ServiceMetadata 단위 테스트
// Design Ref: SVC-MESH-R13 Plan
// Plan SC: FR-MESH.4

import { describe, it, expect, beforeEach } from 'vitest';
import { ServiceMetadata } from '../src/service-metadata.js';

describe('ServiceMetadata', () => {
  let metadata: ServiceMetadata;

  beforeEach(() => {
    metadata = new ServiceMetadata({
      name: 'auth-service',
      version: '0.1.0',
    });
  });

  it('기본 설정으로 메타데이터를 생성한다', () => {
    const result = metadata.getMetadata();

    expect(result.service.name).toBe('auth-service');
    expect(result.service.version).toBe('0.1.0');
    expect(result.service.namespace).toBe('default');
    expect(result.service.protocols).toEqual(['http']);
    expect(result.service.dependencies).toEqual([]);
    expect(result.service.labels).toEqual({});
  });

  it('런타임 정보를 포함한다', () => {
    const result = metadata.getMetadata();

    expect(result.runtime.nodeVersion).toBe(process.version);
    expect(result.runtime.pid).toBe(process.pid);
    expect(typeof result.runtime.uptime).toBe('number');
    expect(result.runtime.uptime).toBeGreaterThanOrEqual(0);
  });

  it('커스텀 설정을 반영한다', () => {
    const custom = new ServiceMetadata({
      name: 'billing-service',
      version: '1.2.3',
      namespace: 'production',
      sidecarInjected: true,
      protocols: ['http', 'grpc'],
      dependencies: ['db', 'redis'],
      labels: { team: 'platform' },
    });

    const result = custom.getMetadata();

    expect(result.service.namespace).toBe('production');
    expect(result.service.sidecarInjected).toBe(true);
    expect(result.service.protocols).toEqual(['http', 'grpc']);
    expect(result.service.dependencies).toEqual(['db', 'redis']);
    expect(result.service.labels).toEqual({ team: 'platform' });
  });

  it('k8s 표준 레이블을 반환한다', () => {
    const labels = metadata.getLabels();

    expect(labels['app.kubernetes.io/name']).toBe('auth-service');
    expect(labels['app.kubernetes.io/version']).toBe('0.1.0');
    expect(labels['app.kubernetes.io/component']).toBe('microservice');
    expect(labels['app.kubernetes.io/part-of']).toBe('public-saas');
  });

  it('커스텀 레이블이 k8s 레이블과 병합된다', () => {
    const custom = new ServiceMetadata({
      name: 'test-svc',
      version: '1.0.0',
      labels: { 'team': 'backend', 'env': 'staging' },
    });

    const labels = custom.getLabels();

    expect(labels['app.kubernetes.io/name']).toBe('test-svc');
    expect(labels['team']).toBe('backend');
    expect(labels['env']).toBe('staging');
  });

  it('getName()이 서비스 이름을 반환한다', () => {
    expect(metadata.getName()).toBe('auth-service');
  });

  it('getVersion()이 서비스 버전을 반환한다', () => {
    expect(metadata.getVersion()).toBe('0.1.0');
  });
});
