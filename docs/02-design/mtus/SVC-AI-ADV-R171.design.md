# SVC-AI-ADV-R171 Design — AI기반 자율 인프라 최적화

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 클러스터 리소스 낭비 감소 및 서비스 안정성 확보 |
| WHO | 인프라 운영팀, SRE |
| RISK | 과도한 스케일링 → 비용 급증, 미흡한 스케일링 → 서비스 불안정 |
| SUCCESS | 이상 탐지 및 액션 생성 자동화 |
| SCOPE | 구현 파일: `autonomous-infra-optimizer.ts` |

## 클래스 설계

### `AutonomousInfraOptimizer`

| 메서드 | 설명 |
|--------|------|
| `recordMetric(metric)` | 노드 리소스 메트릭 기록 |
| `detectAnomalies(nodeId)` | 고부하(>85%)/저부하(<20%) 이상 탐지 |
| `generateActions(nodeId)` | scale_up/scale_down/rebalance/evict 액션 생성 |
| `generateReport()` | 전체 노드 인프라 보고서 |
| `getAuditLog()` | CSAP D-06 감사 로그 반환 |

## 보안 설계 (CSAP D-12)

- 입력 검증: nodeId, utilizationPct(0~100) 범위 검증
- 감사 로그: 모든 이상 탐지 및 액션 생성 기록

## 추적성 매트릭스

| FR ID | 구현 메서드 | 테스트 케이스 | CSAP |
|-------|-----------|--------------|------|
| FR-R171.1 | recordMetric | 메트릭 기록 | D-12 |
| FR-R171.2 | detectAnomalies | 고/저부하 탐지 | D-06 |
| FR-R171.3 | generateActions | 액션 생성 | D-06 |
| FR-R171.4 | generateReport | 보고서 생성 | D-06 |
| FR-R171.5 | getAuditLog | 감사 로그 | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 최초 작성 | ai-impl-a |
