# SVC-AI-ADV-R81 — 설계

## 모듈
- `agentic-code-reviewer.ts`
  - `AgenticCodeReviewer` 클래스

## 핵심 타입
```typescript
type DataGrade = 'C' | 'S' | 'O';
type StepName = 'design' | 'security' | 'quality' | 'compliance';
type Verdict = 'pass' | 'warn' | 'fail';
type FinalVerdict = 'allow' | 'warn' | 'block';

interface PatchHunk {
  file: string;
  added: string[];   // 추가된 라인
  removed: string[]; // 제거된 라인
}

interface ReviewRequest {
  id: string;
  tenantId: string;
  author: string;
  hunks: PatchHunk[];
  grade: DataGrade; // O만 허용
  tags?: string[];
}

interface StepResult {
  step: StepName;
  verdict: Verdict;
  findings: string[];
  rationale: string;
}

interface ReviewResult {
  requestId: string;
  verdict: FinalVerdict;
  steps: StepResult[];
  reason: string;
}

type StepExecutor = (req: ReviewRequest) => Promise<StepResult>;

interface AgenticReviewerOptions {
  executors?: Partial<Record<StepName, StepExecutor>>;
  blockOnComplianceFail: boolean; // default true
}
```

## 선차단 패턴 (FR-R81.1)
```
시크릿: /api[_-]?key\s*=\s*['"][^'"]+['"]/i
        /password\s*=\s*['"][^'"]+['"]/i
        /secret\s*=\s*['"][^'"]{6,}['"]/i
SQL 결합: /execute\(.*\$\{.*\}/  (템플릿 리터럴 결합)
평문 암호: /bcrypt\.compare\(.*password.*==/
```

## 파이프라인
1. **design**: 헝크 수, 파일 수, 중복 여부 (단순 통계 기반)
2. **security**: 시크릿/SQL/XSS 정규식 매칭 → 발견 시 fail
3. **quality**: 추가 라인 중 80자 초과, 중첩 깊이 4+ 검사
4. **compliance**: CSAP 금지 패턴(평문 저장, 인증 없는 쿼리) 탐지

## 기본 executor
모듈 내부 정규식 기반 기본 executor 5종 제공. 사용자가 주입 시 LLM 기반으로 대체 가능.

## 최종 판결
- 하나라도 fail → block (compliance step fail은 반드시 block)
- 하나라도 warn, 나머지 pass → warn
- 전부 pass → allow

## API
- `review(request)` → ReviewResult
- `addPattern(step, regex)` — 런타임 규칙 확장
- `getAuditLog()`

## 감사 이벤트
REVIEW_START / STEP / BLOCKED / WARN / ALLOWED / GRADE_BLOCKED / PATTERN_HIT
