/**
 * 중앙 감사 수집기 테스트
 * Design Ref: MTU-N179
 */

import { CentralAuditCollector, AuditSource, AuditSeverity } from '../src/collector';

describe('CentralAuditCollector', () => {
  let collector: CentralAuditCollector;

  beforeEach(() => {
    collector = new CentralAuditCollector();
  });

  const createEvent = (overrides = {}) => ({
    timestamp: '2026-04-10T10:00:00Z',
    source: AuditSource.Application,
    severity: AuditSeverity.Info,
    actor: { id: 'user-001', type: 'user' as const },
    action: 'USER_LOGIN',
    resource: { type: 'session', id: 'sess-001' },
    result: 'success' as const,
    ...overrides,
  });

  describe('collect', () => {
    it('이벤트 수집 및 해시 체인 생성', () => {
      const record = collector.collect(createEvent());
      expect(record.hash).toBeDefined();
      expect(record.hash.length).toBe(64); // SHA-256
      expect(record.sequenceNumber).toBe(1);
    });

    it('연속 수집 시 해시 체인 연결', () => {
      const r1 = collector.collect(createEvent({ action: 'LOGIN' }));
      const r2 = collector.collect(createEvent({ action: 'LOGOUT' }));

      expect(r2.previousHash).toBe(r1.hash);
      expect(r2.sequenceNumber).toBe(2);
    });
  });

  describe('verifyIntegrity', () => {
    it('정상 체인 무결성 통과', () => {
      collector.collect(createEvent({ action: 'A' }));
      collector.collect(createEvent({ action: 'B' }));
      collector.collect(createEvent({ action: 'C' }));

      const result = collector.verifyIntegrity();
      expect(result.valid).toBe(true);
      expect(result.totalRecords).toBe(3);
    });

    it('빈 체인 무결성 통과', () => {
      const result = collector.verifyIntegrity();
      expect(result.valid).toBe(true);
      expect(result.totalRecords).toBe(0);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      collector.collect(
        createEvent({
          source: AuditSource.Application,
          action: 'USER_LOGIN',
          result: 'success',
        }),
      );
      collector.collect(
        createEvent({
          source: AuditSource.Keycloak,
          action: 'TOKEN_REFRESH',
          result: 'success',
        }),
      );
      collector.collect(
        createEvent({
          source: AuditSource.Kubernetes,
          action: 'POD_DELETE',
          result: 'failure',
        }),
      );
    });

    it('소스별 필터링', () => {
      const results = collector.search({ source: AuditSource.Keycloak });
      expect(results.length).toBe(1);
    });

    it('결과별 필터링', () => {
      const results = collector.search({ result: 'failure' });
      expect(results.length).toBe(1);
    });

    it('액션 키워드 검색', () => {
      const results = collector.search({ action: 'USER' });
      expect(results.length).toBe(1);
    });
  });

  describe('generateCSAPEvidence', () => {
    it('CSAP D-06 증적 생성', () => {
      collector.collect(createEvent());
      collector.collect(createEvent({ severity: AuditSeverity.Critical }));

      const evidence = collector.generateCSAPEvidence('2026-04-01T00:00:00Z', '2026-04-30T23:59:59Z');

      expect(evidence.totalEvents).toBe(2);
      expect(evidence.criticalEvents).toBe(1);
      expect(evidence.integrityStatus).toContain('PASS');
      expect(evidence.retentionDays).toBe(365);
    });
  });
});
