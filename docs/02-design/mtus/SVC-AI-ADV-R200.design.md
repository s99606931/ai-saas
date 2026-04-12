# SVC-AI-ADV-R200 Design — AI기반 서버 리소스 자동 스케일링

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 트래픽 급변 시 자동 리소스 조정 |
| SCOPE | 구현 파일: `resource-autoscaling-ai.ts` |

## 스케일링 임계값

| 조건 | 액션 |
|------|------|
| avgCPU ≥ 80% OR avgMemory ≥ 80% | SCALE_UP |
| avgCPU ≤ 30% AND avgMemory ≤ 30% | SCALE_DOWN |
| 그 외 | NO_CHANGE |

- 최근 3개 스냅샷 평균 기반
- newReplicas: min/maxReplicas 경계 준수

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R200.1 | registerNode | 노드 등록 | D-12 |
| FR-R200.2 | recordSnapshot | 스냅샷 기록 | D-12 |
| FR-R200.3 | evaluate | SCALE_UP | D-12 |
| FR-R200.4 | evaluate | SCALE_DOWN + 경계 | D-12 |
| FR-R200.5 | getAuditLog | 감사 로그 | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 최초 작성 | ai-impl-a |
