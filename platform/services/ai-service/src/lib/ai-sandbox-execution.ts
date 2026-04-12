// AI Sandbox Execution — FR-R73.1~R73.5
// Design Ref: SVC-AI-ADV-R73 DESIGN §모듈
// Plan SC: 차단율 100%, 정상 실행 p95 < 2s
// CSAP: D-12 시스템 개발 보안, D-06 감사
// N2SF: N-05 등급

export type DataGrade = 'C' | 'S' | 'O';
export type Language = 'python' | 'javascript';

export interface SandboxPolicy {
  maxCpuMs: number;
  maxWallMs: number;
  maxMemoryMb: number;
  maxStdoutBytes: number;
  maxSteps: number;
  allowNetwork: boolean;
  allowFileWrite: boolean;
  deniedApis: string[];
}

export interface SandboxJob {
  id: string;
  language: Language;
  code: string;
  grade: DataGrade;
  input?: string;
  submittedAt: number;
}

export type ExecStatus =
  | 'ok'
  | 'denied'
  | 'timeout'
  | 'memory'
  | 'stdout_overflow'
  | 'blocked_api'
  | 'error';

export interface SandboxResult {
  jobId: string;
  status: ExecStatus;
  stdout: string;
  stderr?: string;
  cpuMs: number;
  wallMs: number;
  memoryMb: number;
  steps: number;
  violations: string[];
  finishedAt: number;
}

export interface AuditEvent {
  event:
    | 'SUBMIT'
    | 'STATIC_DENY'
    | 'EXEC'
    | 'VIOLATION'
    | 'COMPLETE'
    | 'GRADE_BLOCK'
    | 'POLICY_REJECT';
  jobId?: string;
  detail?: string;
  at: number;
}

const DEFAULT_POLICY: SandboxPolicy = {
  maxCpuMs: 1000,
  maxWallMs: 2000,
  maxMemoryMb: 128,
  maxStdoutBytes: 16_384,
  maxSteps: 10_000,
  allowNetwork: false,
  allowFileWrite: false,
  deniedApis: [],
};

const PYTHON_DENY: RegExp[] = [
  /import\s+(os|sys|subprocess|socket|urllib|requests|shutil|ctypes)\b/,
  /from\s+(os|sys|subprocess|socket|urllib|requests|shutil|ctypes)\s+import/,
  /open\s*\([^)]*['"](w|a|wb|ab|w\+|a\+)['"]/,
  /\bexec\s*\(/,
  /\beval\s*\(/,
  /__import__\s*\(/,
];

const JS_DENY: RegExp[] = [
  /require\(['"](fs|net|http|https|child_process|os|dns|tls)['"]\)/,
  /import\s+[^;]*\s+from\s+['"](fs|net|http|https|child_process|os|dns|tls)['"]/,
  /\beval\s*\(/,
  /new\s+Function\s*\(/,
  /process\s*\.\s*(exit|kill|binding)/,
];

const INFINITE_LOOP = /while\s*\(\s*(true|1)\s*\)|while\s+True\s*:/;

export class AiSandboxExecutor {
  private policy: SandboxPolicy;
  private readonly audit: AuditEvent[] = [];

  constructor(policy: Partial<SandboxPolicy> = {}) {
    this.policy = this.resolvePolicy(policy);
  }

  setPolicy(policy: Partial<SandboxPolicy>): void {
    this.policy = this.resolvePolicy(policy);
  }

  getPolicy(): SandboxPolicy {
    return { ...this.policy };
  }

  // ── 정적 검사 ────────────────────────────────────────────────────────────
  staticCheck(language: Language, code: string): string[] {
    const violations: string[] = [];
    const patterns = language === 'python' ? PYTHON_DENY : JS_DENY;
    for (const p of patterns) {
      if (p.test(code)) {
        violations.push(`denied-api:${p.source}`);
      }
    }
    if (INFINITE_LOOP.test(code)) {
      violations.push('infinite-loop');
    }
    for (const denied of this.policy.deniedApis) {
      if (code.includes(denied)) {
        violations.push(`custom-deny:${denied}`);
      }
    }
    return violations;
  }

  // ── 실행 ──────────────────────────────────────────────────────────────────
  submit(job: SandboxJob): SandboxResult {
    if (job.grade === 'C' || job.grade === 'S') {
      this.audit.push({
        event: 'GRADE_BLOCK',
        jobId: job.id,
        detail: `grade=${job.grade}`,
        at: Date.now(),
      });
      throw new Error('SANDBOX_GRADE_BLOCKED');
    }
    this.audit.push({ event: 'SUBMIT', jobId: job.id, at: Date.now() });

    const staticViolations = this.staticCheck(job.language, job.code);
    if (staticViolations.length > 0) {
      this.audit.push({
        event: 'STATIC_DENY',
        jobId: job.id,
        detail: staticViolations.join(','),
        at: Date.now(),
      });
      return {
        jobId: job.id,
        status: 'blocked_api',
        stdout: '',
        cpuMs: 0,
        wallMs: 0,
        memoryMb: 0,
        steps: 0,
        violations: staticViolations,
        finishedAt: Date.now(),
      };
    }

    return this.simulate(job);
  }

  getAuditLog(): AuditEvent[] {
    return this.audit.map((e) => ({ ...e }));
  }

  // ── 내부 시뮬레이션 ───────────────────────────────────────────────────────
  private simulate(job: SandboxJob): SandboxResult {
    const lines = job.code.split(/\r?\n/).filter((l) => l.trim().length > 0);
    let cpuMs = 0;
    let wallMs = 0;
    let memoryMb = 1;
    let steps = 0;
    let stdout = '';
    const violations: string[] = [];
    let status: ExecStatus = 'ok';

    this.audit.push({ event: 'EXEC', jobId: job.id, at: Date.now() });

    for (const line of lines) {
      steps += 1;
      cpuMs += 1;
      wallMs += 1;

      // sleep 계열 시뮬레이션
      const sleepPy = /time\.sleep\(\s*(\d+(?:\.\d+)?)\s*\)/.exec(line);
      const sleepJs = /sleep\(\s*(\d+)\s*\)/.exec(line);
      if (sleepPy) {
        const sec = parseFloat(sleepPy[1] ?? '0');
        wallMs += Math.floor(sec * 1000);
      } else if (sleepJs) {
        wallMs += parseInt(sleepJs[1] ?? '0', 10);
      }

      // print/console.log → stdout
      const py = /print\s*\(\s*['"]([^'"]*)['"]\s*\)/.exec(line);
      const js = /console\.log\s*\(\s*['"]([^'"]*)['"]\s*\)/.exec(line);
      const out = py?.[1] ?? js?.[1];
      if (out !== undefined) {
        stdout += out + '\n';
      }

      // 메모리 할당 시뮬레이션 (list/array 리터럴 크기)
      const alloc = /\[[^\]]{10,}\]/.test(line);
      if (alloc) {
        memoryMb += 4;
      }

      // 리소스 체크
      if (cpuMs > this.policy.maxCpuMs) {
        status = 'timeout';
        violations.push(`cpu>${this.policy.maxCpuMs}`);
        break;
      }
      if (wallMs > this.policy.maxWallMs) {
        status = 'timeout';
        violations.push(`wall>${this.policy.maxWallMs}`);
        break;
      }
      if (memoryMb > this.policy.maxMemoryMb) {
        status = 'memory';
        violations.push(`mem>${this.policy.maxMemoryMb}`);
        break;
      }
      if (stdout.length > this.policy.maxStdoutBytes) {
        status = 'stdout_overflow';
        violations.push(`stdout>${this.policy.maxStdoutBytes}`);
        stdout = stdout.slice(0, this.policy.maxStdoutBytes);
        break;
      }
      if (steps > this.policy.maxSteps) {
        status = 'timeout';
        violations.push(`steps>${this.policy.maxSteps}`);
        break;
      }
    }

    if (violations.length > 0) {
      this.audit.push({
        event: 'VIOLATION',
        jobId: job.id,
        detail: violations.join(','),
        at: Date.now(),
      });
    }

    const result: SandboxResult = {
      jobId: job.id,
      status,
      stdout,
      cpuMs,
      wallMs,
      memoryMb,
      steps,
      violations,
      finishedAt: Date.now(),
    };
    this.audit.push({
      event: 'COMPLETE',
      jobId: job.id,
      detail: status,
      at: result.finishedAt,
    });
    return result;
  }

  private resolvePolicy(override: Partial<SandboxPolicy>): SandboxPolicy {
    const p: SandboxPolicy = { ...DEFAULT_POLICY, ...override };
    if (p.allowNetwork) {
      this.audit.push({
        event: 'POLICY_REJECT',
        detail: 'allowNetwork=true',
        at: Date.now(),
      });
      throw new Error('SANDBOX_NETWORK_FORBIDDEN');
    }
    if (p.allowFileWrite) {
      this.audit.push({
        event: 'POLICY_REJECT',
        detail: 'allowFileWrite=true',
        at: Date.now(),
      });
      throw new Error('SANDBOX_FILE_WRITE_FORBIDDEN');
    }
    if (p.maxCpuMs <= 0 || p.maxWallMs <= 0 || p.maxMemoryMb <= 0) {
      throw new Error('SANDBOX_POLICY_INVALID');
    }
    return p;
  }
}
