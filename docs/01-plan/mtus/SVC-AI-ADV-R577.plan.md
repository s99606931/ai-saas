# SVC-AI-ADV-R577 Plan — AI기반 실시간 장애 전파 분석

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 서비스 장애 전파 경로 분석으로 빠른 원인 파악 지원 |
| WHO | 운영 엔지니어 |
| RISK | N2SF C/S 등급 데이터 외부 전송 금지 |
| SUCCESS | 장애 등록, 전파 경로 추적, 영향 범위 산출 |
| SCOPE | failure-propagation-analyzer-ai.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R577.1 | 서비스 노드 등록 (nodeId, name, dependencies[]) |
| FR-R577.2 | 장애 기록 (failureId, nodeId, dataGrade?) — C/S 차단 |
| FR-R577.3 | 장애 영향 노드 수 반환 (전파 BFS) |
| FR-R577.4 | 활성 장애 목록 반환 |
| FR-R577.5 | 감사 로그 getAuditLog() |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
