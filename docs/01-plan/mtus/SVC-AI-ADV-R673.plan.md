# SVC-AI-ADV-R673 Plan — AI기반 공공서비스 접근성 향상 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 장애인·고령자 대상 공공서비스 접근성 자동 평가 및 개선 권고 |
| WHO | 공공서비스 운영팀, 접근성 담당관 |
| RISK | N2SF C/S 등급 사용자 데이터 외부 전송 금지 |
| SUCCESS | FR-R673.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/public-service-accessibility-ai-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R673.1 | 페이지 등록 (pageId, url, wcagLevel) |
| FR-R673.2 | 접근성 이슈 신고 (dataGrade? C/S 차단) |
| FR-R673.3 | WCAG 2.1 기반 심각도 산출 (CRITICAL/MAJOR/MINOR) |
| FR-R673.4 | 개선 권고 (BLOCK_RELEASE/FIX_NOW/BACKLOG) |
| FR-R673.5 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
