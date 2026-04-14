# SVC-AI-ADV-R576 Plan — AI기반 공공기관 위험 관리 자동화 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공기관 위험 항목 자동 평가 및 우선순위 산정 |
| WHO | 위험 관리 담당자 |
| RISK | N2SF C/S 등급 데이터 외부 전송 금지 |
| SUCCESS | 위험 등록, 위험 점수 산출, 고위험 목록 반환 |
| SCOPE | risk-management-automator-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R576.1 | 위험 항목 등록 (riskId, name, category) |
| FR-R576.2 | 위험 평가 기록 (riskId, likelihood, impact, dataGrade?) — C/S 차단 |
| FR-R576.3 | 위험 점수 산출 = likelihood * impact |
| FR-R576.4 | 고위험 항목 목록 반환 (점수 >= 15) |
| FR-R576.5 | 감사 로그 getAuditLog() |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
