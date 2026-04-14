# SVC-AI-ADV-R665 Plan — AI기반 공공조달 사기 탐지 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공조달 입찰 데이터에서 담합·사기 패턴 탐지 |
| WHO | 조달청 감사 / 부정행위 조사팀 |
| RISK | 입찰자 식별정보(사업자번호) 외부 전송 금지 |
| SUCCESS | FR-R665.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/public-procurement-fraud-detector-v3.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R665.1 | 입찰 레코드 분석 (bidder/amount/timestamp) |
| FR-R665.2 | 의심도 점수 산출 (가격 편차·동일IP·반복 수주) |
| FR-R665.3 | dataGrade C/S 차단 (N2SF N-05) |
| FR-R665.4 | bidder PII SHA-256 16자 마스킹 |
| FR-R665.5 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
