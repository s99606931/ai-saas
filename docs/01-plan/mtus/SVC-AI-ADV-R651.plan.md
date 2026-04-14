# SVC-AI-ADV-R651 Plan — AI 모델 거버넌스 자동화 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | AI 모델 등록·승인·폐기 거버넌스 자동화 |
| WHO | AI 거버넌스 담당 |
| RISK | N2SF C/S 등급 학습 데이터 외부 전송 금지 |
| SUCCESS | FR-R651.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/ai-model-governance-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R651.1 | 모델 등록 (modelId, version, owner) |
| FR-R651.2 | 심사 항목 평가 (dataGrade? C/S 차단) |
| FR-R651.3 | owner PII SHA-256 16자 hex 마스킹 |
| FR-R651.4 | 승인 상태 판정 (APPROVED/CONDITIONAL/REJECTED) |
| FR-R651.5 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
