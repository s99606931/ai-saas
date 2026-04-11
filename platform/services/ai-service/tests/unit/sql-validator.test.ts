// SVC-AI-ADV-R31 단위 테스트: SQL 검증기
// Design Ref: SVC-AI-ADV-R31 DESIGN §3~§7
// Plan SC: FR-ADV31.3~31.7
// CSAP: D-12 SQL 주입 방지, 매개변수화 쿼리 강제

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  SqlValidator,
  getSqlValidator,
  resetSqlValidator,
} from '../../src/lib/sql-validator.js';

// ── 기본 검증 — Design §3 ──────────────────────────────────────────────

describe('SqlValidator 기본 검증', () => {
  let validator: SqlValidator;

  beforeEach(() => {
    validator = new SqlValidator();
  });

  it('유효한 SELECT 문을 허용한다', () => {
    const result = validator.validate('SELECT id, name FROM users WHERE active = true LIMIT 10');
    expect(result.isValid).toBe(true);
    expect(result.isSafe).toBe(true);
    expect(result.sanitizedSql).toBeDefined();
  });

  it('WITH 문을 허용한다', () => {
    const result = validator.validate('WITH cte AS (SELECT id FROM users) SELECT * FROM cte LIMIT 10');
    expect(result.isValid).toBe(true);
  });

  it('빈 쿼리를 거부한다', () => {
    const result = validator.validate('');
    expect(result.isValid).toBe(false);
    expect(result.errors[0]!.code).toBe('EMPTY_SQL');
  });

  it('공백만 있는 쿼리를 거부한다', () => {
    const result = validator.validate('   ');
    expect(result.isValid).toBe(false);
  });
});

// ── 읽기 전용 모드 — Design §5 ────────────────────────────────────────

describe('SqlValidator 읽기 전용 모드 (FR-ADV31.5)', () => {
  let validator: SqlValidator;

  beforeEach(() => {
    validator = new SqlValidator({ readOnly: true });
  });

  it('INSERT를 차단한다', () => {
    const result = validator.validate("INSERT INTO users VALUES (1, 'test')");
    expect(result.isValid).toBe(false);
    const critical = result.errors.filter((e) => e.severity === 'critical');
    expect(critical.length).toBeGreaterThan(0);
  });

  it('UPDATE를 차단한다', () => {
    const result = validator.validate("UPDATE users SET name = 'x' WHERE id = 1");
    expect(result.isValid).toBe(false);
  });

  it('DELETE를 차단한다', () => {
    const result = validator.validate('DELETE FROM users WHERE id = 1');
    expect(result.isValid).toBe(false);
  });

  it('DROP을 차단한다', () => {
    const result = validator.validate('DROP TABLE users');
    expect(result.isValid).toBe(false);
  });

  it('ALTER를 차단한다', () => {
    const result = validator.validate('ALTER TABLE users ADD COLUMN age INT');
    expect(result.isValid).toBe(false);
  });

  it('TRUNCATE를 차단한다', () => {
    const result = validator.validate('TRUNCATE TABLE users');
    expect(result.isValid).toBe(false);
  });
});

// ── SQL 주입 방지 — Design §3 (CSAP D-12) ──────────────────────────────

describe('SqlValidator SQL 주입 방지 (FR-ADV31.3)', () => {
  let validator: SqlValidator;

  beforeEach(() => {
    validator = new SqlValidator();
  });

  it('스택 쿼리 주입을 감지한다', () => {
    const result = validator.validate("SELECT * FROM users; DROP TABLE users");
    expect(result.isSafe).toBe(false);
    expect(result.errors.some((e) => e.code === 'SQL_INJECTION_STACKED' || e.code === 'MULTI_STATEMENT')).toBe(true);
  });

  it('SQL 주석 주입을 감지한다', () => {
    const result = validator.validate("SELECT * FROM users WHERE id = 1 --");
    expect(result.errors.some((e) => e.code === 'SQL_COMMENT_INJECTION')).toBe(true);
  });

  it('UNION SELECT 주입을 감지한다', () => {
    const result = validator.validate("SELECT name FROM users UNION SELECT password FROM admin");
    expect(result.errors.some((e) => e.code === 'SQL_UNION_INJECTION')).toBe(true);
  });

  it('시간 기반 주입을 감지한다', () => {
    const result = validator.validate("SELECT * FROM users WHERE SLEEP(5)");
    expect(result.errors.some((e) => e.code === 'SQL_TIME_BASED')).toBe(true);
  });

  it('파일 접근 패턴을 감지한다', () => {
    const result = validator.validate("SELECT LOAD_FILE('/etc/passwd')");
    expect(result.errors.some((e) => e.code === 'SQL_FILE_ACCESS')).toBe(true);
  });

  it('시스템 스키마 탐색을 감지한다', () => {
    const result = validator.validate("SELECT * FROM information_schema.tables");
    expect(result.errors.some((e) => e.code === 'SQL_SCHEMA_PROBE')).toBe(true);
  });

  it('다중 문장을 차단한다', () => {
    const result = validator.validate("SELECT 1; SELECT 2");
    expect(result.errors.some((e) => e.code === 'MULTI_STATEMENT')).toBe(true);
  });
});

// ── 구조 검증 — Design §7 ──────────────────────────────────────────────

describe('SqlValidator 구조 검증 (FR-ADV31.7)', () => {
  let validator: SqlValidator;

  beforeEach(() => {
    validator = new SqlValidator({ maxSubqueryDepth: 2, maxUnionCount: 2, maxLimit: 100 });
  });

  it('서브쿼리 깊이 초과를 감지한다', () => {
    const result = validator.validate('SELECT * FROM (SELECT * FROM (SELECT * FROM (SELECT 1) t1) t2) t3 LIMIT 10');
    expect(result.errors.some((e) => e.code === 'SUBQUERY_DEPTH_EXCEEDED')).toBe(true);
  });

  it('UNION 개수 초과를 감지한다', () => {
    const result = validator.validate('SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 LIMIT 10');
    expect(result.errors.some((e) => e.code === 'UNION_COUNT_EXCEEDED')).toBe(true);
  });

  it('LIMIT 초과를 감지한다', () => {
    const result = validator.validate('SELECT * FROM users LIMIT 999');
    expect(result.errors.some((e) => e.code === 'LIMIT_EXCEEDED')).toBe(true);
  });

  it('LIMIT 없으면 경고한다', () => {
    const result = validator.validate('SELECT id FROM users');
    expect(result.warnings.some((w) => w.code === 'NO_LIMIT')).toBe(true);
  });

  it('SELECT * 경고를 표시한다', () => {
    const result = validator.validate('SELECT * FROM users LIMIT 10');
    expect(result.warnings.some((w) => w.code === 'SELECT_STAR')).toBe(true);
  });

  it('괄호 불일치를 경고한다', () => {
    const result = validator.validate('SELECT * FROM (SELECT 1 LIMIT 10');
    expect(result.warnings.some((w) => w.code === 'UNBALANCED_PARENS')).toBe(true);
  });
});

// ── LIMIT 보장 — Design §7 ─────────────────────────────────────────────

describe('SqlValidator LIMIT 보장', () => {
  let validator: SqlValidator;

  beforeEach(() => {
    validator = new SqlValidator({ defaultLimit: 100, maxLimit: 1000 });
  });

  it('LIMIT 없으면 자동 추가한다', () => {
    const sql = validator.ensureLimit('SELECT * FROM users');
    expect(sql).toContain('LIMIT 100');
  });

  it('기존 LIMIT를 상한값으로 제한한다', () => {
    const sql = validator.ensureLimit('SELECT * FROM users LIMIT 5000');
    expect(sql).toContain('LIMIT 1000');
  });

  it('기존 LIMIT가 상한 이내면 유지한다', () => {
    const sql = validator.ensureLimit('SELECT * FROM users LIMIT 50');
    expect(sql).toContain('LIMIT 50');
  });

  it('세미콜론을 제거한다', () => {
    const sql = validator.ensureLimit('SELECT * FROM users;');
    expect(sql).not.toContain(';');
  });
});

// ── 파라미터화 — Design §4 (CSAP D-12) ─────────────────────────────────

describe('SqlValidator 파라미터화 (FR-ADV31.4)', () => {
  let validator: SqlValidator;

  beforeEach(() => {
    validator = new SqlValidator();
  });

  it('문자열 리터럴을 파라미터로 변환한다', () => {
    const result = validator.parameterize("SELECT * FROM users WHERE name = 'admin'");
    expect(result.sql).toContain('$1');
    expect(result.sql).not.toContain("'admin'");
    expect(result.parameters).toContain('admin');
  });

  it('여러 문자열 리터럴을 변환한다', () => {
    const result = validator.parameterize("SELECT * FROM users WHERE name = 'admin' AND role = 'user'");
    expect(result.parameters).toHaveLength(2);
    expect(result.parameters[0]).toBe('admin');
    expect(result.parameters[1]).toBe('user');
  });

  it('빈 문자열도 파라미터화한다', () => {
    const result = validator.parameterize("SELECT * FROM users WHERE name = ''");
    expect(result.parameters).toHaveLength(1);
    expect(result.parameters[0]).toBe('');
  });
});

// ── 팩토리 함수 ──────────────────────────────────────────────────────────

describe('SqlValidator 팩토리', () => {
  afterEach(() => {
    resetSqlValidator();
  });

  it('싱글턴 인스턴스를 반환한다', () => {
    const v1 = getSqlValidator();
    const v2 = getSqlValidator();
    expect(v1).toBe(v2);
  });

  it('리셋 후 새 인스턴스를 생성한다', () => {
    const v1 = getSqlValidator();
    resetSqlValidator();
    const v2 = getSqlValidator();
    expect(v1).not.toBe(v2);
  });
});
