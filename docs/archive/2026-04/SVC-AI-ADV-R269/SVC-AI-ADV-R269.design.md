# SVC-AI-ADV-R269 — 설계

## 아키텍처

```
registerRunbook({id, steps[], approver})
executeStep(runbookId, stepId, result) — PENDING→RUNNING→COMPLETED|FAILED
rollback(runbookId, stepId)
getStatus(runbookId) → {completed, failed, pending, progressPct, durationMs}
```

## 상태 전이

- PENDING → RUNNING → (COMPLETED | FAILED)
- FAILED → ROLLED_BACK (rollback 호출 시)
- 의존 단계 미완료 시 실행 거부

## 보안

- DR 런북 내용: O등급만 허용
- 승인자 ID 기록 (마스킹)
- 모든 상태 전이 감사 로그
