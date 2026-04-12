# SVC-AI-ADV-R250 — 팀 협업 워크플로우 최적화기 Design

> 작성일: 2026-04-13 | 버전: 1.0.0

## 컴포넌트 설계

```
TeamCollaborationOptimizer
├── registerMember(profile)
├── registerTask(task)
├── analyzeWorkload(): WorkloadReport
├── recommendAssignment(taskId): AssignmentRecommendation
├── detectBottlenecks(): Bottleneck[]
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **부하율**: 할당 시간 / 가용 시간
- **스킬 매칭 점수**: 필요 스킬 ∩ 보유 스킬 비율 × 100
- **배분 점수**: 스킬매칭×0.6 + (1−부하율)×0.4 × 100
- **병목 판정**: 부하율 > 1.0 → CRITICAL, > 0.8 → HIGH, 스킬갭 → MEDIUM

## CSAP D-06 준수

- 배분 권고·병목 탐지 감사 로그
- N2SF C/S 등급 차단
