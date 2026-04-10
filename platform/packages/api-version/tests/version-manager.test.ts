// @public-saas/api-version 버전 관리자 테스트
// Design Ref: SVC-APIVER-R9 Plan
// Plan SC: FR-APIVER.1~FR-APIVER.4

import { describe, it, expect, beforeEach } from 'vitest';
import { ApiVersionManager } from '../src/version-manager.js';

describe('ApiVersionManager -- 기본 기능', () => {
  let manager: ApiVersionManager;

  beforeEach(() => {
    manager = new ApiVersionManager();
    manager.registerVersion({ version: 'v1', status: 'active' });
    manager.registerVersion({
      version: 'v2',
      status: 'active',
    });
    manager.registerVersion({
      version: 'v0',
      status: 'deprecated',
      sunsetDate: '2026-06-30T00:00:00Z',
      replacedBy: 'v1',
    });
  });

  it('버전 등록 + 조회', () => {
    expect(manager.getVersion('v1')).toBeDefined();
    expect(manager.getVersion('v1')?.status).toBe('active');
    expect(manager.getVersion('v99')).toBeUndefined();
  });

  it('모든 버전 목록', () => {
    expect(manager.listVersions().length).toBe(3);
  });

  it('활성 버전만 필터', () => {
    const active = manager.getActiveVersions();
    expect(active.length).toBe(2);
    expect(active.map((v) => v.version)).toContain('v1');
    expect(active.map((v) => v.version)).toContain('v2');
  });

  it('기본 버전 설정/조회', () => {
    expect(manager.getDefaultVersion()).toBe('v1');
    manager.setDefaultVersion('v2');
    expect(manager.getDefaultVersion()).toBe('v2');
  });
});

describe('ApiVersionManager -- URL 버전 추출', () => {
  let manager: ApiVersionManager;

  beforeEach(() => {
    manager = new ApiVersionManager();
    manager.registerVersion({ version: 'v1', status: 'active' });
    manager.registerVersion({ version: 'v2', status: 'active' });
  });

  it('/v1/tenants -> v1, /tenants', () => {
    const result = manager.extractVersion('/v1/tenants');
    expect(result.version).toBe('v1');
    expect(result.path).toBe('/tenants');
  });

  it('/v2/users/123 -> v2, /users/123', () => {
    const result = manager.extractVersion('/v2/users/123');
    expect(result.version).toBe('v2');
    expect(result.path).toBe('/users/123');
  });

  it('/tenants -> 기본 버전(v1), /tenants', () => {
    const result = manager.extractVersion('/tenants');
    expect(result.version).toBe('v1');
    expect(result.path).toBe('/tenants');
  });

  it('/v1 -> v1, /', () => {
    const result = manager.extractVersion('/v1');
    expect(result.version).toBe('v1');
    expect(result.path).toBe('/');
  });

  it('/health -> 기본 버전(v1), /health', () => {
    const result = manager.extractVersion('/health');
    expect(result.version).toBe('v1');
    expect(result.path).toBe('/health');
  });
});

describe('ApiVersionManager -- 버전 유효성', () => {
  let manager: ApiVersionManager;

  beforeEach(() => {
    manager = new ApiVersionManager();
    manager.registerVersion({ version: 'v1', status: 'active' });
    manager.registerVersion({
      version: 'v0',
      status: 'deprecated',
      sunsetDate: '2026-06-30',
      replacedBy: 'v1',
    });
    manager.registerVersion({ version: 'v0beta', status: 'sunset' });
  });

  it('등록된 버전은 유효', () => {
    expect(manager.isValidVersion('v1')).toBe(true);
    expect(manager.isValidVersion('v0')).toBe(true);
  });

  it('미등록 버전은 무효', () => {
    expect(manager.isValidVersion('v99')).toBe(false);
  });

  it('active/deprecated는 사용 가능', () => {
    expect(manager.isUsableVersion('v1')).toBe(true);
    expect(manager.isUsableVersion('v0')).toBe(true);
  });

  it('sunset 버전은 사용 불가', () => {
    expect(manager.isUsableVersion('v0beta')).toBe(false);
  });
});

describe('ApiVersionManager -- Deprecation 헤더', () => {
  let manager: ApiVersionManager;

  beforeEach(() => {
    manager = new ApiVersionManager();
    manager.registerVersion({ version: 'v1', status: 'active' });
    manager.registerVersion({
      version: 'v0',
      status: 'deprecated',
      sunsetDate: '2026-06-30T00:00:00Z',
      replacedBy: 'v1',
    });
    manager.registerVersion({ version: 'v0beta', status: 'sunset' });
  });

  it('active 버전 -- 헤더 없음', () => {
    const headers = manager.getDeprecationHeaders('v1');
    expect(Object.keys(headers).length).toBe(0);
  });

  it('deprecated 버전 -- Deprecation + Sunset + Link 헤더', () => {
    const headers = manager.getDeprecationHeaders('v0');
    expect(headers['Deprecation']).toBe('true');
    expect(headers['Sunset']).toBeDefined();
    expect(headers['Link']).toContain('v1');
    expect(headers['X-API-Replace-With']).toBe('v1');
    expect(headers['X-API-Deprecated']).toContain('deprecated');
  });

  it('sunset 버전 -- Sunset 안내 헤더', () => {
    const headers = manager.getDeprecationHeaders('v0beta');
    expect(headers['X-API-Sunset']).toContain('sunset');
  });
});

describe('ApiVersionManager -- 경로 생성 헬퍼', () => {
  const manager = new ApiVersionManager();

  it('versionedPath 정상 생성', () => {
    expect(manager.versionedPath('v1', '/tenants')).toBe('/v1/tenants');
    expect(manager.versionedPath('v2', '/users/123')).toBe('/v2/users/123');
  });

  it('basePath에 슬래시 없는 경우 자동 추가', () => {
    expect(manager.versionedPath('v1', 'tenants')).toBe('/v1/tenants');
  });
});
