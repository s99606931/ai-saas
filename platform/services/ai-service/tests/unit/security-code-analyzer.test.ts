// SVC-AI-ADV-R34 단위 테스트: 보안 코드 분석기
// Design Ref: SVC-AI-ADV-R34 DESIGN §1, §3
// Plan SC: FR-ADV34.1, FR-ADV34.3
// CSAP: D-12 보안 코딩, D-06 보안 감사
// OWASP: Top 10 패턴 탐지

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  SecurityCodeAnalyzer,
  getSecurityCodeAnalyzer,
  resetSecurityCodeAnalyzer,
} from '../../src/lib/security-code-analyzer.js';

// -- 보안 규칙 탐지 -- Design §1 -----------------------------------------------

describe('SecurityCodeAnalyzer 보안 규칙 (FR-ADV34.1)', () => {
  let analyzer: SecurityCodeAnalyzer;

  beforeEach(() => {
    analyzer = new SecurityCodeAnalyzer();
  });

  it('12개 이상의 기본 보안 규칙을 보유한다', () => {
    expect(analyzer.getRules().length).toBeGreaterThanOrEqual(12);
  });

  it('SQL 템플릿 리터럴 주입을 감지한다 (SEC-001)', () => {
    const code = 'const result = query(`SELECT * FROM users WHERE id = ${userId}`)';
    const issues = analyzer.analyzeCode(code, 'test.ts');
    const sqlIssues = issues.filter((i) => i.ruleId === 'SEC-001');
    expect(sqlIssues.length).toBeGreaterThan(0);
    expect(sqlIssues[0]!.severity).toBe('critical');
    expect(sqlIssues[0]!.category).toBe('sql_injection');
  });

  it('SQL 문자열 연결을 감지한다 (SEC-002)', () => {
    const code = "const result = query('SELECT * FROM users WHERE id = ' + userId)";
    const issues = analyzer.analyzeCode(code, 'test.ts');
    const sqlIssues = issues.filter((i) => i.ruleId === 'SEC-002');
    expect(sqlIssues.length).toBeGreaterThan(0);
  });

  it('innerHTML 직접 할당을 감지한다 (SEC-003)', () => {
    const code = 'element.innerHTML = userInput';
    const issues = analyzer.analyzeCode(code, 'test.ts');
    const xssIssues = issues.filter((i) => i.ruleId === 'SEC-003');
    expect(xssIssues.length).toBeGreaterThan(0);
    expect(xssIssues[0]!.category).toBe('xss');
  });

  it('dangerouslySetInnerHTML을 감지한다 (SEC-004)', () => {
    const code = '<div dangerouslySetInnerHTML={{ __html: content }} />';
    const issues = analyzer.analyzeCode(code, 'test.tsx');
    expect(issues.some((i) => i.ruleId === 'SEC-004')).toBe(true);
  });

  it('하드코딩된 API 키를 감지한다 (SEC-005)', () => {
    const code = "const apiKey = 'abcdefgh12345678ijklmnop'";
    const issues = analyzer.analyzeCode(code, 'test.ts');
    expect(issues.some((i) => i.ruleId === 'SEC-005')).toBe(true);
    expect(issues.some((i) => i.severity === 'critical')).toBe(true);
  });

  it('AWS 접근 키를 감지한다 (SEC-006)', () => {
    const code = "const awsKey = 'AKIAIOSFODNN7EXAMPLE'";
    const issues = analyzer.analyzeCode(code, 'test.ts');
    expect(issues.some((i) => i.ruleId === 'SEC-006')).toBe(true);
  });

  it('eval 사용을 감지한다 (SEC-008)', () => {
    const code = 'const result = eval(userInput)';
    const issues = analyzer.analyzeCode(code, 'test.ts');
    expect(issues.some((i) => i.ruleId === 'SEC-008')).toBe(true);
    expect(issues.some((i) => i.category === 'unsafe_deserialization')).toBe(true);
  });

  it('Function 생성자를 감지한다 (SEC-009)', () => {
    const code = "const fn = new Function('return ' + userInput)";
    const issues = analyzer.analyzeCode(code, 'test.ts');
    expect(issues.some((i) => i.ruleId === 'SEC-009')).toBe(true);
  });

  it('Math.random 보안 목적 사용을 감지한다 (SEC-011)', () => {
    const code = 'const token = Math.random().toString(36)';
    const issues = analyzer.analyzeCode(code, 'test.ts');
    expect(issues.some((i) => i.ruleId === 'SEC-011')).toBe(true);
    expect(issues.some((i) => i.category === 'insecure_random')).toBe(true);
  });

  it('주석 행은 건너뛴다', () => {
    const code = '// const apiKey = "sk-1234567890abcdef12345678"';
    const issues = analyzer.analyzeCode(code, 'test.ts');
    expect(issues).toHaveLength(0);
  });

  it('안전한 코드에서는 이슈가 없다', () => {
    const code = [
      'import { z } from "zod"',
      'const schema = z.object({ name: z.string() })',
      'const data = schema.parse(req.body)',
    ].join('\n');
    const issues = analyzer.analyzeCode(code, 'test.ts');
    expect(issues).toHaveLength(0);
  });

  it('이슈에 줄 번호를 기록한다', () => {
    const code = 'const safe = true\nconst result = eval(input)';
    const issues = analyzer.analyzeCode(code, 'test.ts');
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]!.line).toBe(2);
  });

  it('이슈에 파일 경로를 기록한다', () => {
    const code = 'const result = eval(input)';
    const issues = analyzer.analyzeCode(code, 'src/api/handler.ts');
    expect(issues[0]!.filePath).toBe('src/api/handler.ts');
  });

  it('이슈에 CSAP 참조를 포함한다', () => {
    const code = 'const result = query(`SELECT * FROM t WHERE id = ${id}`)';
    const issues = analyzer.analyzeCode(code, 'test.ts');
    expect(issues.some((i) => i.csapRef && i.csapRef.startsWith('D-'))).toBe(true);
  });

  it('이슈에 OWASP 참조를 포함한다', () => {
    const code = 'const result = eval(input)';
    const issues = analyzer.analyzeCode(code, 'test.ts');
    expect(issues.some((i) => i.owaspRef && i.owaspRef.includes('A0'))).toBe(true);
  });
});

// -- 규칙 필터링 ---------------------------------------------------------------

describe('SecurityCodeAnalyzer 규칙 관리', () => {
  it('ignoreRules로 특정 규칙을 제외한다', () => {
    const analyzer = new SecurityCodeAnalyzer({
      ignoreRules: ['SEC-011'],
    });
    const code = 'const token = Math.random().toString(36)';
    const issues = analyzer.analyzeCode(code, 'test.ts');
    expect(issues.some((i) => i.ruleId === 'SEC-011')).toBe(false);
  });

  it('customRules로 사용자 규칙을 추가한다', () => {
    const analyzer = new SecurityCodeAnalyzer({
      customRules: [
        {
          id: 'CUSTOM-001',
          name: '커스텀 규칙',
          category: 'code_smell',
          severity: 'low',
          pattern: /console\.log\(/,
          message: 'console.log 사용 감지',
          suggestion: 'logger를 사용하십시오',
        },
      ],
    });
    const code = 'console.log("debug")';
    const issues = analyzer.analyzeCode(code, 'test.ts');
    expect(issues.some((i) => i.ruleId === 'CUSTOM-001')).toBe(true);
  });
});

// -- 복잡도 분석 -- Design §3 --------------------------------------------------

describe('SecurityCodeAnalyzer 복잡도 분석 (FR-ADV34.3)', () => {
  let analyzer: SecurityCodeAnalyzer;

  beforeEach(() => {
    analyzer = new SecurityCodeAnalyzer({
      maxFunctionLines: 10,
      maxNestingDepth: 2,
      maxParameters: 3,
      maxCyclomaticComplexity: 5,
    });
  });

  it('함수를 감지하고 복잡도를 계산한다', () => {
    const code = [
      'function processData(a) {',
      '  if (a > 0) {',
      '    return a * 2',
      '  }',
      '  return 0',
      '}',
    ].join('\n');
    const metrics = analyzer.analyzeComplexity(code, 'test.ts');
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics[0]!.functionName).toBe('processData');
    expect(metrics[0]!.cyclomaticComplexity).toBeGreaterThanOrEqual(1);
  });

  it('순환 복잡도 초과를 감지한다', () => {
    const code = [
      'function complex(a, b, c) {',
      '  if (a) {',
      '    if (b) {',
      '      if (c) {',
      '        return 1',
      '      } else if (a && b) {',
      '        return 2',
      '      } else if (b || c) {',
      '        return 3',
      '      }',
      '    }',
      '  }',
      '  return 0',
      '}',
    ].join('\n');
    const metrics = analyzer.analyzeComplexity(code, 'test.ts');
    const complex = metrics.find((m) => m.functionName === 'complex');
    if (complex) {
      expect(complex.cyclomaticComplexity).toBeGreaterThan(5);
      expect(complex.issues.length).toBeGreaterThan(0);
      expect(complex.issues.some((i) => i.includes('순환 복잡도'))).toBe(true);
    }
  });

  it('함수 줄 수 초과를 감지한다', () => {
    const lines = ['function longFunc() {'];
    for (let i = 0; i < 15; i++) {
      lines.push(`  const x${i} = ${i}`);
    }
    lines.push('}');
    const code = lines.join('\n');

    const metrics = analyzer.analyzeComplexity(code, 'test.ts');
    const func = metrics.find((m) => m.functionName === 'longFunc');
    if (func) {
      expect(func.issues.some((i) => i.includes('함수 줄 수'))).toBe(true);
    }
  });

  it('빈 코드에서 빈 결과를 반환한다', () => {
    const metrics = analyzer.analyzeComplexity('', 'test.ts');
    expect(metrics).toHaveLength(0);
  });
});

// -- 통합 분석 ----------------------------------------------------------------

describe('SecurityCodeAnalyzer 통합 분석', () => {
  it('보안 + 복잡도 통합 결과를 반환한다', () => {
    const analyzer = new SecurityCodeAnalyzer();
    const code = [
      'function handler(req) {',
      '  const data = eval(req.body)',
      '  return data',
      '}',
    ].join('\n');

    const result = analyzer.analyze(code, 'handler.ts');
    expect(result.security.length).toBeGreaterThan(0);
    expect(result.complexity).toBeDefined();
  });
});

// -- 팩토리 ------------------------------------------------------------------

describe('SecurityCodeAnalyzer 팩토리', () => {
  afterEach(() => {
    resetSecurityCodeAnalyzer();
  });

  it('싱글턴 인스턴스를 반환한다', () => {
    const a1 = getSecurityCodeAnalyzer();
    const a2 = getSecurityCodeAnalyzer();
    expect(a1).toBe(a2);
  });

  it('리셋 후 새 인스턴스를 생성한다', () => {
    const a1 = getSecurityCodeAnalyzer();
    resetSecurityCodeAnalyzer();
    const a2 = getSecurityCodeAnalyzer();
    expect(a1).not.toBe(a2);
  });
});
