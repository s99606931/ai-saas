# SVC-AI-ADV-R118 — Policy-Aware Response Filter (Design)

> 작성일: 2026-04-12 | 버전: 1.0.0

## Design Anchor

- **아키텍처**: 정책 규칙 파이프라인 (순차 평가) + 첫 번째 `block` 판정 시 즉시 종료
- **선정 이유**: Pragmatic Balance — 규칙 명시성 + 성능(단일 패스)

## 인터페이스

```typescript
type Action = 'block' | 'mask' | 'flag'
type Severity = 'low' | 'medium' | 'high' | 'critical'

interface PolicyRule {
  id: string
  description: string
  pattern: RegExp | string   // string은 부분 일치
  action: Action
  severity: Severity
  replacement?: string       // mask용
}

interface FilterRequest {
  text: string
  grade: DataGrade
  policyVersion?: string
}

interface FilterFinding {
  ruleId: string
  severity: Severity
  action: Action
  matches: number
}

interface FilterResult {
  allowed: boolean
  text: string                // mask/flag 처리 후
  findings: FilterFinding[]
  blocked: boolean
  policyVersion: string
}

class PolicyAwareResponseFilter {
  constructor(options?: { rules?: PolicyRule[]; policyVersion?: string })
  addRule(rule: PolicyRule): void
  filter(req: FilterRequest): FilterResult
  getAuditLog(): readonly FilterAuditEntry[]
}
```

## 기본 규칙 세트

1. 금칙어: 비속어/욕설 → action=mask
2. PII: email/RRN/phone → action=mask
3. 정치 편향 표현 → action=flag
4. 허위 광고성 표현("100% 무조건") → action=block
5. 내부 시스템 경로 노출 (/etc/, /root/) → action=block

## 성능/보안

- 규칙 수 ≤ 100 가정, regex pre-compile
- block 발생 시 즉시 종료 (early exit)
- grade C/S는 사전 차단

## Session Guide

1. filter() 호출 → grade 검사
2. 각 규칙 순회 → match 시 action 분기
3. block → allowed=false, 즉시 반환
4. mask → replacement로 치환
5. flag → finding에만 기록
6. 최종 결과 + 감사 로그
