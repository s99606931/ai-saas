# SVC-AI-ADV-R267 — 기술 부채 자동 측정 Design

> 작성일: 2026-04-13 | 버전: 1.0.0

## 컴포넌트 설계

```
TechDebtMeasurementAI
├── registerComponent(id, name, language, linesOfCode)
├── recordMetrics(componentId, complexity, duplication, outdatedDeps, grade)
├── calculateDebt(componentId): DebtScore
│   └── 복잡도(40%) + 중복도(30%) + 노후화(30%) 가중 점수
├── getPrioritizedDebt(): DebtItem[]
│   └── 부채 점수 내림차순 정렬
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **복잡도 점수**: cyclomatic complexity → 정규화 (10당 10점)
- **중복도 점수**: duplication% 직접 사용
- **노후화 점수**: outdated deps 수 × 10, 최대 100
- **종합 부채**: 0-100 점수, 높을수록 부채 심각

## CSAP D-12 준수

- 부채 측정 결과 감사 로그
- N2SF C/S 등급 차단
