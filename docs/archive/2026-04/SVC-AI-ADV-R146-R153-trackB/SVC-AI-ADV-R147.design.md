# SVC-AI-ADV-R147 — 코드 리뷰 자동 승인 엔진 (Design)

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R147.plan.md

## 1. 아키텍처

```
registerRiskRule → evaluatePr(pr)
      ↓
CodeReviewAutoApprover
  ├─ 파일별 위험도 점수 합산
  ├─ 보안 파일 변경 → 자동 차단
  ├─ score < threshold → AUTO_APPROVE
  └─ getAuditLog() — append-only
```

## 2. 타입 정의

```typescript
export type Decision = 'AUTO_APPROVE' | 'REQUEST_REVIEW' | 'BLOCK'
export interface RiskRule {
  ruleId: string; pattern: string; riskScore: number; description: string }
export interface PrFile { path: string; additions: number; deletions: number }
export interface PrEvaluation {
  prId: string; totalScore: number; decision: Decision
  triggeredRules: string[]; evaluatedAt: string }
```

## 3. 알고리즘

### §3.1 파일 위험도: 규칙 패턴(glob) 매칭 → riskScore 합산
### §3.2 크기 보정: `(additions + deletions) > 500` → +20점
### §3.3 결정: score ≥ 80 → BLOCK, score ≥ 30 → REQUEST_REVIEW, else AUTO_APPROVE
### §3.4 기본 규칙: 보안 파일(.env, secrets, *.key) → 80점 자동 차단

## 4. Design Anchor
- CSAP D-06: 평가 감사 로그, D-12: 시크릿 파일 변경 차단
