import { describe, it, expect } from 'vitest';
import {
  AgenticCodeReviewer,
  type ReviewRequest,
  type PatchHunk,
} from '../agentic-code-reviewer.js';

function mkReq(id: string, hunks: PatchHunk[], grade: 'O' | 'C' | 'S' = 'O'): ReviewRequest {
  return {
    id,
    tenantId: 't1',
    author: 'dev1',
    hunks,
    grade,
  };
}

function mkHunk(file: string, added: string[]): PatchHunk {
  return { file, added, removed: [] };
}

describe('grade guard (FR-R81.1, N-05)', () => {
  it('O 등급 허용', async () => {
    const r = new AgenticCodeReviewer();
    const res = await r.review(mkReq('r1', [mkHunk('a.ts', ['const x = 1;'])]));
    expect(res.requestId).toBe('r1');
  });

  it('C 등급 차단', async () => {
    const r = new AgenticCodeReviewer();
    await expect(
      r.review(mkReq('r1', [mkHunk('a.ts', ['x'])], 'C')),
    ).rejects.toThrow('REVIEW_GRADE_BLOCKED');
    expect(r.getAuditLog().some((e) => e.action === 'GRADE_BLOCKED')).toBe(true);
  });

  it('S 등급 차단', async () => {
    const r = new AgenticCodeReviewer();
    await expect(
      r.review(mkReq('r1', [mkHunk('a.ts', ['x'])], 'S')),
    ).rejects.toThrow('REVIEW_GRADE_BLOCKED');
  });
});

describe('4단계 파이프라인 (FR-R81.2)', () => {
  it('4개 step 모두 실행', async () => {
    const r = new AgenticCodeReviewer();
    const res = await r.review(mkReq('r1', [mkHunk('a.ts', ['const a = 1;'])]));
    expect(res.steps).toHaveLength(4);
    expect(res.steps.map((s) => s.step)).toEqual([
      'design',
      'security',
      'quality',
      'compliance',
    ]);
  });

  it('단계별 감사 이벤트 기록', async () => {
    const r = new AgenticCodeReviewer();
    await r.review(mkReq('r1', [mkHunk('a.ts', ['const a = 1;'])]));
    const stepEvents = r.getAuditLog().filter((e) => e.action === 'STEP');
    expect(stepEvents).toHaveLength(4);
  });
});

describe('보안 단계 (FR-R81.3)', () => {
  it('API 키 하드코딩 탐지', async () => {
    const r = new AgenticCodeReviewer();
    const res = await r.review(
      mkReq('r1', [mkHunk('a.ts', ['const apiKey = "sk-abc123def";'])]),
    );
    const sec = res.steps.find((s) => s.step === 'security');
    expect(sec?.verdict).toBe('fail');
    expect(sec?.findings.length).toBeGreaterThan(0);
  });

  it('SQL 주입 패턴 탐지', async () => {
    const r = new AgenticCodeReviewer();
    const res = await r.review(
      mkReq('r1', [
        mkHunk('a.ts', ['db.execute(`SELECT * FROM users WHERE id = ${userId}`)']),
      ]),
    );
    const sec = res.steps.find((s) => s.step === 'security');
    expect(sec?.verdict).toBe('fail');
  });

  it('XSS 패턴 탐지', async () => {
    const r = new AgenticCodeReviewer();
    const res = await r.review(
      mkReq('r1', [mkHunk('a.ts', ['el.innerHTML = "<b>" + name + "</b>"'])]),
    );
    const sec = res.steps.find((s) => s.step === 'security');
    expect(sec?.verdict).toBe('fail');
  });

  it('안전한 코드 통과', async () => {
    const r = new AgenticCodeReviewer();
    const res = await r.review(
      mkReq('r1', [mkHunk('a.ts', ['const x = 1;', 'const y = x + 2;'])]),
    );
    const sec = res.steps.find((s) => s.step === 'security');
    expect(sec?.verdict).toBe('pass');
  });
});

describe('품질 단계 (FR-R81.3)', () => {
  it('긴 라인 경고', async () => {
    const r = new AgenticCodeReviewer();
    const longLine = 'const x = ' + '"a"'.repeat(50) + ';';
    const res = await r.review(mkReq('r1', [mkHunk('a.ts', [longLine])]));
    const q = res.steps.find((s) => s.step === 'quality');
    expect(q?.verdict).toBe('warn');
  });

  it('짧은 라인 통과', async () => {
    const r = new AgenticCodeReviewer();
    const res = await r.review(mkReq('r1', [mkHunk('a.ts', ['const x = 1;'])]));
    const q = res.steps.find((s) => s.step === 'quality');
    expect(q?.verdict).toBe('pass');
  });
});

describe('compliance 단계 차단 (FR-R81.4)', () => {
  it('평문 비밀번호 저장 → block', async () => {
    const r = new AgenticCodeReviewer();
    const res = await r.review(
      mkReq('r1', [mkHunk('a.ts', ['db.create({ password: plainPassword })'])]),
    );
    expect(res.verdict).toBe('block');
    const comp = res.steps.find((s) => s.step === 'compliance');
    expect(comp?.verdict).toBe('fail');
  });

  it('깨끗한 코드 → allow', async () => {
    const r = new AgenticCodeReviewer();
    const res = await r.review(
      mkReq('r1', [mkHunk('a.ts', ['const a = 1;', 'const b = 2;'])]),
    );
    expect(res.verdict).toBe('allow');
  });

  it('품질 warn만 있으면 → warn', async () => {
    const r = new AgenticCodeReviewer();
    const longLine = 'x'.repeat(130);
    const res = await r.review(mkReq('r1', [mkHunk('a.ts', [longLine])]));
    expect(res.verdict).toBe('warn');
  });
});

describe('design 단계 (FR-R81.3)', () => {
  it('빈 패치 경고', async () => {
    const r = new AgenticCodeReviewer();
    const res = await r.review(mkReq('r1', []));
    const d = res.steps.find((s) => s.step === 'design');
    expect(d?.verdict).toBe('warn');
  });

  it('대용량 패치 경고', async () => {
    const r = new AgenticCodeReviewer();
    const many = Array.from({ length: 600 }, (_, i) => `const v${i} = ${i};`);
    const res = await r.review(mkReq('r1', [mkHunk('a.ts', many)]));
    const d = res.steps.find((s) => s.step === 'design');
    expect(d?.verdict).toBe('warn');
  });
});

describe('감사 로그 (FR-R81.5)', () => {
  it('block 시 BLOCKED 기록', async () => {
    const r = new AgenticCodeReviewer();
    await r.review(
      mkReq('r1', [mkHunk('a.ts', ['db.create({ password: plain })'])]),
    );
    expect(r.getAuditLog().some((e) => e.action === 'BLOCKED')).toBe(true);
  });

  it('allow 시 ALLOWED 기록', async () => {
    const r = new AgenticCodeReviewer();
    await r.review(mkReq('r1', [mkHunk('a.ts', ['const x = 1;'])]));
    expect(r.getAuditLog().some((e) => e.action === 'ALLOWED')).toBe(true);
  });

  it('REVIEW_START 기록', async () => {
    const r = new AgenticCodeReviewer();
    await r.review(mkReq('r1', [mkHunk('a.ts', ['const x = 1;'])]));
    expect(r.getAuditLog()[0]?.action).toBe('REVIEW_START');
  });
});

describe('executor 주입', () => {
  it('사용자 정의 security executor 사용', async () => {
    const r = new AgenticCodeReviewer({
      executors: {
        security: async () => ({
          step: 'security',
          verdict: 'fail',
          findings: ['custom'],
          rationale: 'custom',
        }),
      },
    });
    const res = await r.review(mkReq('r1', [mkHunk('a.ts', ['const x = 1;'])]));
    const sec = res.steps.find((s) => s.step === 'security');
    expect(sec?.findings).toEqual(['custom']);
    expect(res.verdict).toBe('block');
  });
});

describe('addPattern', () => {
  it('런타임 security 패턴 추가', async () => {
    const r = new AgenticCodeReviewer();
    r.addPattern('security', /FORBIDDEN_CALL/);
    const res = await r.review(
      mkReq('r1', [mkHunk('a.ts', ['FORBIDDEN_CALL()'])]),
    );
    const sec = res.steps.find((s) => s.step === 'security');
    expect(sec?.verdict).toBe('fail');
  });
});
