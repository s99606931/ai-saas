# SVC-AI-ADV-R153 — 조직 온보딩 AI (Design)

> 작성일: 2026-04-12 | Plan: SVC-AI-ADV-R153.plan.md

## 1. 아키텍처

```
registerOrg → generateOnboardingPlan → completeStep → getProgress
      ↓
OrgOnboardingAi
  ├─ 조직 유형별 스텝 템플릿
  ├─ completeStep() — 완료 처리
  ├─ getProgress() — 완료율 + 다음 스텝
  └─ getAuditLog() — append-only
```

## 2. 타입 정의

```typescript
export type OrgType = 'central' | 'local' | 'public-institution'
export interface Org { orgId: string; name: string; type: OrgType; size: number }
export interface OnboardingStep {
  stepId: string; orgId: string; order: number; title: string
  description: string; category: string; done: boolean }
export interface OnboardingProgress {
  orgId: string; totalSteps: number; doneSteps: number
  completionRate: number; nextStep: OnboardingStep | null }
```

## 3. 알고리즘

### §3.1 스텝 템플릿: 공통 10개 + central 5개 추가 + local 3개 추가
### §3.2 다음 스텝: done=false 중 order 최소값
### §3.3 완료율: doneSteps / totalSteps

## 4. Design Anchor
- CSAP D-06: 온보딩 감사 로그
