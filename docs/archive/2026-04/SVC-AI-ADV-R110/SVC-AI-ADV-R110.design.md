# SVC-AI-ADV-R110 — Data Policy Enforcer (Design)

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R110.plan.md

## 1. 아키텍처

```
registerPolicy
      ↓
DataPolicyEnforcer
  ├─ scanCode() — 정책 규칙 일괄 매칭
  ├─ suggestFix() — 위반별 수정 제안 생성
  ├─ scanAndFix() — 일괄 처리
  └─ getAuditLog() — append-only 배열
```

## 2. 타입 정의

```typescript
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type Language = 'typescript' | 'javascript' | 'python' | 'sql'

export interface DataPolicy {
  policyId: string
  name: string
  pattern: string     // 정규식 문자열
  severity: Severity
  description: string
  suggestedFix: string  // 수정 제안 템플릿
}

export interface PolicyViolation {
  policyId: string
  policyName: string
  severity: Severity
  matchedText: string
  lineNumber: number
  columnStart: number
  description: string
}

export interface FixSuggestion {
  violation: PolicyViolation
  suggestion: string
  autoFixable: boolean
}

export interface ScanResult {
  violations: PolicyViolation[]
  fixes: FixSuggestion[]
  scannedAt: string
  totalLines: number
}

export interface AuditEntry {
  timestamp: string
  action: string
  language: Language
  violationCount: number
}
```

## 3. 알고리즘

### §3.1 스캔
- 코드를 줄 단위로 분리
- 각 줄에 대해 등록된 모든 정책 패턴 매칭 (RegExp)
- 위반 발생 시 라인 번호, 매칭 텍스트 기록

### §3.2 수정 제안
- 정책의 `suggestedFix` 템플릿 반환
- `{matched}` 플레이스홀더를 실제 매칭 텍스트로 치환
- `autoFixable` 여부: 정책에 `autoFix` 플래그 시 true

### §3.3 기본 정책 (CSAP D-12 기반)
- 하드코딩 시크릿: `(api[_-]?key|password|secret)\s*=\s*['"][^'"]{8,}['"]` (CRITICAL)
- SQL 직접 결합: `` `SELECT.*\$\{`` (HIGH)
- console.log 민감 정보: `console\.(log|error).*password` (MEDIUM)

## 4. Design Anchor

- CSAP D-12: 시스템 개발 보안 — 입력 검증, 하드코딩 금지
- CSAP D-06: 스캔 감사 로그
