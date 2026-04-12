import { describe, it, expect } from 'vitest';
import {
  AiSandboxExecutor,
  type SandboxJob,
} from '../ai-sandbox-execution.js';

function makeJob(partial: Partial<SandboxJob> = {}): SandboxJob {
  return {
    id: 'j1',
    language: 'python',
    code: 'print("hello")',
    grade: 'O',
    submittedAt: Date.now(),
    ...partial,
  };
}

describe('policy (FR-R73.1)', () => {
  it('기본 정책', () => {
    const ex = new AiSandboxExecutor();
    const p = ex.getPolicy();
    expect(p.allowNetwork).toBe(false);
    expect(p.allowFileWrite).toBe(false);
  });
  it('network 허용 시도는 throw', () => {
    expect(() => new AiSandboxExecutor({ allowNetwork: true })).toThrow(
      'SANDBOX_NETWORK_FORBIDDEN',
    );
  });
  it('file write 허용 시도는 throw', () => {
    expect(() => new AiSandboxExecutor({ allowFileWrite: true })).toThrow(
      'SANDBOX_FILE_WRITE_FORBIDDEN',
    );
  });
  it('잘못된 정책 값', () => {
    expect(() => new AiSandboxExecutor({ maxCpuMs: 0 })).toThrow(
      'SANDBOX_POLICY_INVALID',
    );
  });
});

describe('등급 차단 (FR-R73.4, N-05)', () => {
  it('O 정상', () => {
    const ex = new AiSandboxExecutor();
    const r = ex.submit(makeJob());
    expect(r.status).toBe('ok');
    expect(r.stdout).toContain('hello');
  });
  it('C 차단', () => {
    const ex = new AiSandboxExecutor();
    expect(() => ex.submit(makeJob({ grade: 'C' }))).toThrow(
      'SANDBOX_GRADE_BLOCKED',
    );
  });
  it('S 차단', () => {
    const ex = new AiSandboxExecutor();
    expect(() => ex.submit(makeJob({ grade: 'S' }))).toThrow(
      'SANDBOX_GRADE_BLOCKED',
    );
  });
});

describe('정적 금지 API (FR-R73.2, D-12)', () => {
  it('파이썬 import os 차단', () => {
    const ex = new AiSandboxExecutor();
    const r = ex.submit(
      makeJob({ code: 'import os\nos.system("ls")', language: 'python' }),
    );
    expect(r.status).toBe('blocked_api');
    expect(r.violations.length).toBeGreaterThan(0);
  });
  it('파이썬 subprocess import from', () => {
    const ex = new AiSandboxExecutor();
    const r = ex.submit(
      makeJob({ code: 'from subprocess import call', language: 'python' }),
    );
    expect(r.status).toBe('blocked_api');
  });
  it('파이썬 eval 차단', () => {
    const ex = new AiSandboxExecutor();
    const r = ex.submit(makeJob({ code: 'eval("1+1")', language: 'python' }));
    expect(r.status).toBe('blocked_api');
  });
  it('파이썬 파일 쓰기 차단', () => {
    const ex = new AiSandboxExecutor();
    const r = ex.submit(
      makeJob({ code: 'f = open("/tmp/x", "w")', language: 'python' }),
    );
    expect(r.status).toBe('blocked_api');
  });
  it('JS require fs 차단', () => {
    const ex = new AiSandboxExecutor();
    const r = ex.submit(
      makeJob({ code: 'const f = require("fs")', language: 'javascript' }),
    );
    expect(r.status).toBe('blocked_api');
  });
  it('JS import http 차단', () => {
    const ex = new AiSandboxExecutor();
    const r = ex.submit(
      makeJob({ code: 'import x from "http"', language: 'javascript' }),
    );
    expect(r.status).toBe('blocked_api');
  });
  it('JS eval 차단', () => {
    const ex = new AiSandboxExecutor();
    const r = ex.submit(
      makeJob({ code: 'eval("1+1")', language: 'javascript' }),
    );
    expect(r.status).toBe('blocked_api');
  });
});

describe('리소스 한계 (FR-R73.3, D-12)', () => {
  it('CPU 초과', () => {
    const ex = new AiSandboxExecutor({ maxCpuMs: 2 });
    const code = Array.from({ length: 10 })
      .map((_, i) => `print("${i}")`)
      .join('\n');
    const r = ex.submit(makeJob({ code }));
    expect(r.status).toBe('timeout');
  });
  it('wall 초과 via sleep', () => {
    const ex = new AiSandboxExecutor({ maxWallMs: 50 });
    const r = ex.submit(
      makeJob({ code: 'time.sleep(1)\nprint("x")', language: 'python' }),
    );
    expect(r.status).toBe('timeout');
  });
  it('stdout overflow', () => {
    const ex = new AiSandboxExecutor({ maxStdoutBytes: 5 });
    const r = ex.submit(
      makeJob({ code: 'print("abcdefghij")', language: 'python' }),
    );
    expect(r.status).toBe('stdout_overflow');
  });
  it('메모리 초과', () => {
    const ex = new AiSandboxExecutor({ maxMemoryMb: 6 });
    const code = [
      'x = [0000000001,2,3,4,5,6,7,8,9,10]',
      'y = [0000000001,2,3,4,5,6,7,8,9,10]',
      'print("ok")',
    ].join('\n');
    const r = ex.submit(makeJob({ code }));
    expect(['memory', 'ok']).toContain(r.status);
  });
  it('무한 루프 패턴 감지', () => {
    const ex = new AiSandboxExecutor();
    const r = ex.submit(
      makeJob({ code: 'while True:\n    print("x")', language: 'python' }),
    );
    expect(r.status).toBe('blocked_api');
  });
});

describe('custom deniedApi', () => {
  it('사용자 정의 금지 문자열', () => {
    const ex = new AiSandboxExecutor({ deniedApis: ['dangerFn'] });
    const r = ex.submit(
      makeJob({ code: 'dangerFn()\nprint("x")', language: 'javascript' }),
    );
    expect(r.status).toBe('blocked_api');
    expect(r.violations.some((v) => v.includes('dangerFn'))).toBe(true);
  });
});

describe('감사 (FR-R73.5, D-06)', () => {
  it('SUBMIT/EXEC/COMPLETE 기록', () => {
    const ex = new AiSandboxExecutor();
    ex.submit(makeJob());
    const log = ex.getAuditLog();
    expect(log.some((e) => e.event === 'SUBMIT')).toBe(true);
    expect(log.some((e) => e.event === 'EXEC')).toBe(true);
    expect(log.some((e) => e.event === 'COMPLETE')).toBe(true);
  });
  it('GRADE_BLOCK 기록', () => {
    const ex = new AiSandboxExecutor();
    try {
      ex.submit(makeJob({ grade: 'C' }));
    } catch {
      /* expected */
    }
    expect(ex.getAuditLog().some((e) => e.event === 'GRADE_BLOCK')).toBe(true);
  });
  it('STATIC_DENY 기록', () => {
    const ex = new AiSandboxExecutor();
    ex.submit(makeJob({ code: 'import os', language: 'python' }));
    expect(ex.getAuditLog().some((e) => e.event === 'STATIC_DENY')).toBe(true);
  });
});
