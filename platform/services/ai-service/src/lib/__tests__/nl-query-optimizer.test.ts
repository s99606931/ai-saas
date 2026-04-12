import { describe, it, expect, beforeEach } from 'vitest';
import { NlQueryOptimizer, type NlQuery } from '../nl-query-optimizer';

describe('NlQueryOptimizer', () => {
  let optimizer: NlQueryOptimizer;

  const makeQuery = (id: string, nl: string, context?: string): NlQuery => ({
    id, naturalLanguage: nl, tenantId: 'tenant-1', context,
  });

  beforeEach(() => {
    optimizer = new NlQueryOptimizer();
  });

  // FR-R176.1 쿼리 등록
  it('FR-R176.1 쿼리 등록 및 감사 로그', () => {
    optimizer.registerQuery(makeQuery('q1', '사용자 목록 조회'));
    const log = optimizer.getAuditLog();
    expect(log.some((e) => e.action === 'QUERY_REGISTERED')).toBe(true);
  });

  // FR-R176.2 자연어 → SQL
  it('FR-R176.2 기본 SELECT 쿼리 생성', () => {
    optimizer.registerQuery(makeQuery('q1', '사용자 목록 조회', 'users'));
    const parsed = optimizer.parse('q1');
    expect(parsed.sql).toContain('SELECT');
    expect(parsed.sql).toContain('users');
    expect(parsed.confidence).toBeGreaterThan(0);
  });

  it('FR-R176.2 집계 쿼리 탐지', () => {
    optimizer.registerQuery(makeQuery('q2', '평균 응답 시간을 조회', 'metrics'));
    const parsed = optimizer.parse('q2');
    expect(parsed.queryType).toBe('AGGREGATE');
  });

  it('FR-R176.2 JOIN 쿼리 탐지', () => {
    optimizer.registerQuery(makeQuery('q3', '사용자와 주문을 join', 'users,orders'));
    const parsed = optimizer.parse('q3');
    expect(parsed.queryType).toBe('JOIN');
  });

  it('FR-R176.2 없는 쿼리 파싱 시 에러', () => {
    expect(() => optimizer.parse('unknown')).toThrow();
  });

  // FR-R176.3 최적화 힌트
  it('FR-R176.3 집계 쿼리 파티셔닝 힌트', () => {
    optimizer.registerQuery(makeQuery('q1', '평균 사용량 count', 'metrics'));
    optimizer.parse('q1');
    const hint = optimizer.optimize('q1');
    expect(hint.hints.some((h) => h.includes('파티셔닝') || h.includes('인덱스'))).toBe(true);
    expect(hint.estimatedSpeedupPct).toBeGreaterThan(0);
  });

  it('FR-R176.3 파싱 없이 최적화 시 에러', () => {
    optimizer.registerQuery(makeQuery('q2', '쿼리'));
    expect(() => optimizer.optimize('q2')).toThrow();
  });

  // FR-R176.4 SQL 보안 검사 (CSAP D-12)
  it('FR-R176.4 SQL 주입 탐지', () => {
    const malicious = "SELECT * FROM users; DROP TABLE users";
    const issues = optimizer.securityCheck(malicious);
    expect(issues).toContain('SQL_INJECTION_RISK');
  });

  it('FR-R176.4 SQL 주석 인젝션 탐지', () => {
    const malicious = "SELECT * FROM users -- WHERE 1=1";
    const issues = optimizer.securityCheck(malicious);
    expect(issues).toContain('SQL_COMMENT_INJECTION');
  });

  it('FR-R176.4 안전한 SQL 이슈 없음', () => {
    const safe = "SELECT id, name FROM users WHERE status = $1";
    const issues = optimizer.securityCheck(safe);
    expect(issues).toHaveLength(0);
  });

  // FR-R176.5 감사 로그
  it('FR-R176.5 파싱 후 감사 로그 기록', () => {
    optimizer.registerQuery(makeQuery('q1', '조회', 'table'));
    optimizer.parse('q1');
    const log = optimizer.getAuditLog();
    expect(log.some((e) => e.action === 'QUERY_PARSED')).toBe(true);
  });
});
