# SVC-AI-ADV-R615 Plan — AI기반 규제 변경 탐지 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공기관 SaaS 플랫폼 AI 고도화 |
| WHO | 컴플라이언스 담당자 |
| RISK | N2SF C/S 등급 데이터 외부 전송 금지 |
| SUCCESS | FR-R615.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/regulatory-change-detector-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R615.1 | 규제 스냅샷 등록 |
| FR-R615.2 | N2SF 등급 검사 |
| FR-R615.3 | 변경 diff 탐지 (added/removed/modified) |
| FR-R615.4 | 영향도 HIGH/MEDIUM/LOW 판정 |
| FR-R615.5 | 감사 로그 getAuditLog() |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
