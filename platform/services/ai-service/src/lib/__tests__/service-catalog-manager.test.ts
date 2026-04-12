// MTU-N361 서비스 카탈로그 관리 테스트
import { describe, it, expect } from 'vitest';
import { ServiceCatalogManagerService } from '../service-catalog-manager.js';

describe('MTU-N361 ServiceCatalogManager', () => {
  const svc = new ServiceCatalogManagerService('tenant-n361');

  it('FR-N361.1: 카탈로그 항목 등록', () => {
    const item = svc.register('문서관리', 'docs', '전자문서', 'basic', 10000);
    expect(item.active).toBe(true);
    expect(item.itemId).toMatch(/^cat-/);
  });

  it('FR-N361.2: 검색/필터', () => {
    svc.register('전자결재', 'workflow', '결재', 'premium', 50000);
    const results = svc.search('결재');
    expect(results.length).toBeGreaterThan(0);
  });

  it('FR-N361.3: 구독', () => {
    const sub = svc.subscribe('cat-abc');
    expect(sub.status).toBe('active');
    expect(svc.subscriptions().length).toBeGreaterThan(0);
  });

  it('FR-N361.4: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
