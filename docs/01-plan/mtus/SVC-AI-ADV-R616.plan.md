# SVC-AI-ADV-R616 Plan — AI기반 민원인 여정 최적화 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공기관 SaaS 플랫폼 AI 고도화 |
| WHO | 민원 서비스 기획자 |
| RISK | N2SF C/S 등급 데이터 외부 전송 금지 |
| SUCCESS | FR-R616.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/citizen-journey-optimizer-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R616.1 | 민원인 여정 단계 등록 |
| FR-R616.2 | N2SF 등급 검사 |
| FR-R616.3 | 단계별 이탈률/평균소요 산출 |
| FR-R616.4 | 병목 단계 탐지 + 개선 제안 |
| FR-R616.5 | 민원인ID PII 마스킹 + 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
