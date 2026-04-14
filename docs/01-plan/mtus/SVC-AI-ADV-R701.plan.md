# SVC-AI-ADV-R701 Plan — AI기반 공공 입찰 평가 자동화 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공 입찰 참여사 평가 점수 산출 자동화·공정성 확보 |
| WHO | 조달팀, 평가위원회 |
| RISK | N2SF C/S 입찰사 기밀 금지, 사업자등록번호 PII 마스킹 필수 |
| SUCCESS | FR-R701.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/public-tender-evaluator-ai-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R701.1 | 평가 기준 등록 (criterionId, weight: 0<w≤1) |
| FR-R701.2 | 입찰 제출 (bidId, bizRegNo, scores map) - dataGrade? C/S 차단 |
| FR-R701.3 | 종합 점수 산출 (Σ(score_i × weight_i)) 및 등급(PASS/BORDER/FAIL) |
| FR-R701.4 | 낙찰 후보 정렬 (TOP-N) |
| FR-R701.5 | getAuditLog() append-only (bizRegNo sha256 16자 마스킹) |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
