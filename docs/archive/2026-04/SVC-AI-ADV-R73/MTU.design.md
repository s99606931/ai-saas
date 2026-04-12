# SVC-AI-ADV-R73 — 설계

## 모듈
- `ai-sandbox-execution.ts`
  - `AiSandboxExecutor` 클래스

## 핵심 타입
```typescript
type DataGrade = 'C' | 'S' | 'O';
type Language = 'python' | 'javascript';

interface SandboxPolicy {
  maxCpuMs: number;            // CPU 시간
  maxWallMs: number;           // 벽시계 시간
  maxMemoryMb: number;
  maxStdoutBytes: number;
  maxSteps: number;            // 시뮬레이션 스텝
  allowNetwork: boolean;       // false 고정
  allowFileWrite: boolean;     // false 고정
  deniedApis: string[];        // 금지 API 패턴
}

interface SandboxJob {
  id: string;
  language: Language;
  code: string;
  grade: DataGrade;
  input?: string;
  submittedAt: number;
}

type ExecStatus = 'ok' | 'denied' | 'timeout' | 'memory' | 'stdout_overflow' | 'blocked_api' | 'error';

interface SandboxResult {
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
```

## 정적 검사 규칙
```
Python 금지 패턴:
  - import\s+(os|sys|subprocess|socket|urllib|requests|shutil)
  - open\(..., ['"]w|a['"]
  - exec\(|eval\(|__import__

JavaScript 금지 패턴:
  - require\(['"](fs|net|http|https|child_process|os)['"]
  - import\s+.*from\s+['"](fs|net|http|https|child_process|os)['"]
  - eval\(|Function\(

공통:
  - while\(true\)|while\s+True (무한루프 경고)
```

## 실행 시뮬레이션
```
- 줄 단위 parse → 1 step 로 카운트
- `print(...)` / `console.log(...)` → stdout 누적
- `sleep(ms)` → cpuMs/wallMs 누적
- 각 스텝마다 리소스 체크 (maxCpuMs/maxMemoryMb/maxStdoutBytes/maxSteps)
- 초과 시 즉시 중단 + 해당 status 반환
```

## 보안
- C/S 등급 job → throw `SANDBOX_GRADE_BLOCKED`
- policy.allowNetwork/allowFileWrite true 로 설정 시 throw
- 감사: SUBMIT / STATIC_DENY / EXEC / VIOLATION / COMPLETE / GRADE_BLOCK

## API
- `setPolicy(policy)`
- `submit(job)` → SandboxResult
- `staticCheck(language, code)` → string[] (위반 목록)
- `getAuditLog()`
