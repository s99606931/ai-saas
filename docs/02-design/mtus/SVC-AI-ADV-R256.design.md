# SVC-AI-ADV-R256 — AI 기반 예산 배분 최적화 Design

> 작성일: 2026-04-13 | 버전: 1.0.0

## 컴포넌트 설계

```
AIBudgetAllocator
├── setTotalBudget(amount)
├── registerProject(project, grade)
├── calculateScore(projectId): number
├── allocate(options?): AllocationResult
├── getFairnessMetrics(): FairnessMetrics
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **스코어**: priority*0.4 + urgency*0.3 + executionRate*0.3 (각 0~100)
- **greedy 배분**: 스코어 내림차순, 남은 예산 한도 내에서 요청액의 min(요청, 남은)
- **형평성 보정**: 부서별 총 배분 중 상위 부서가 평균의 2배 초과 시 10% 차감 → 하위 부서 보충
- **Gini 계수**: 부서별 배분 금액 불평등 측정 (0 = 완전 평등, 1 = 완전 불평등)

## CSAP 준수

- D-06: 배분 요청·계산 감사 로그 (부서명 마스킹)
- D-12: 금액 >= 0 검증, 스코어 0~100 범위 보장
- N2SF: C/S 차단
