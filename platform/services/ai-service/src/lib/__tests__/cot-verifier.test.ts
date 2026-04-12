import { describe, it, expect } from 'vitest';
import { CoTVerifier } from '../cot-verifier.js';

describe('parse (FR-R72.1)', () => {
  it('단계 파싱', () => {
    const v = new CoTVerifier();
    const doc = v.parse(
      `Step 1: 시작 값은 100이다.\nStep 2: (step 1) 에서 20을 더하면 120\nTherefore: (step 2) 결과 120`,
      'd1',
      'O',
    );
    expect(doc.steps.length).toBe(2);
    expect(doc.steps[0]?.index).toBe(1);
    expect(doc.steps[1]?.refs).toContain(1);
    expect(doc.conclusion).toContain('120');
  });
  it('C 등급 차단', () => {
    const v = new CoTVerifier();
    expect(() => v.parse('Step 1: x', 'd1', 'C')).toThrow('COT_GRADE_BLOCKED');
  });
  it('S 등급 차단', () => {
    const v = new CoTVerifier();
    expect(() => v.parse('Step 1: x', 'd1', 'S')).toThrow('COT_GRADE_BLOCKED');
  });
});

describe('verify 통과 케이스 (FR-R72.4)', () => {
  it('정상 CoT', () => {
    const v = new CoTVerifier();
    const text = [
      'Step 1: 값은 100',
      'Step 2: (step 1) 에 20을 더해서 120',
      'Therefore: (step 2) 최종 120',
    ].join('\n');
    const r = v.verifyText(text, 'ok1', 'O');
    expect(r.passed).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0.7);
  });
});

describe('verify missing-ref (FR-R72.3)', () => {
  it('존재하지 않는 단계 참조', () => {
    const v = new CoTVerifier();
    const text = [
      'Step 1: 값은 100',
      'Step 2: (step 9) 참조',
      'Therefore: (step 2) 결과',
    ].join('\n');
    const r = v.verifyText(text, 'miss1', 'O');
    expect(r.issues.some((i) => i.kind === 'missing-ref')).toBe(true);
    expect(r.passed).toBe(false);
  });
});

describe('verify circular-ref', () => {
  it('사이클 감지', () => {
    const v = new CoTVerifier();
    const text = [
      'Step 1: (step 2) 로부터',
      'Step 2: (step 1) 로부터',
      'Therefore: (step 2) 결과',
    ].join('\n');
    const r = v.verifyText(text, 'cyc1', 'O');
    expect(r.issues.some((i) => i.kind === 'circular-ref')).toBe(true);
  });
});

describe('verify unsupported-conclusion', () => {
  it('결론이 단계 인용 없음', () => {
    const v = new CoTVerifier();
    const text = [
      'Step 1: 값은 100',
      'Step 2: 값은 120',
      'Therefore: 결론',
    ].join('\n');
    const r = v.verifyText(text, 'unsup1', 'O');
    expect(r.issues.some((i) => i.kind === 'unsupported-conclusion')).toBe(true);
    expect(r.passed).toBe(false);
  });
});

describe('verify numeric-inconsistency', () => {
  it('큰 수치 편차', () => {
    const v = new CoTVerifier();
    const text = [
      'Step 1: 100',
      'Step 2: (step 1) 따라서 500',
      'Therefore: (step 2) 결과',
    ].join('\n');
    const r = v.verifyText(text, 'num1', 'O');
    expect(r.issues.some((i) => i.kind === 'numeric-inconsistency')).toBe(true);
  });
});

describe('parse conclusion fallback', () => {
  it('결론 prefix 없으면 마지막 단계 사용', () => {
    const v = new CoTVerifier();
    const doc = v.parse('Step 1: 값 100\nStep 2: (step 1) 결과 120', 'fb', 'O');
    expect(doc.conclusion.length).toBeGreaterThan(0);
  });
});

describe('verify 점수 계산 (FR-R72.4)', () => {
  it('error 있으면 passed false', () => {
    const v = new CoTVerifier();
    const text = ['Step 1: x', 'Therefore: 결론'].join('\n');
    const r = v.verifyText(text, 'sc1', 'O');
    expect(r.passed).toBe(false);
  });
  it('점수 0 이상 1 이하', () => {
    const v = new CoTVerifier();
    const text = 'Step 1: 100\nStep 2: (step 1) 100\nTherefore: (step 2) 100';
    const r = v.verifyText(text, 'sc2', 'O');
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
  });
});

describe('감사 로그 (FR-R72.5, D-06)', () => {
  it('VERIFY 기록', () => {
    const v = new CoTVerifier();
    v.verifyText('Step 1: 100\nTherefore: (step 1) 100', 'log1', 'O');
    const log = v.getAuditLog();
    expect(log.some((e) => e.event === 'VERIFY')).toBe(true);
  });
  it('GRADE_BLOCK 기록', () => {
    const v = new CoTVerifier();
    try {
      v.parse('Step 1: x', 'bl1', 'C');
    } catch {
      /* expected */
    }
    expect(v.getAuditLog().some((e) => e.event === 'GRADE_BLOCK')).toBe(true);
  });
});
