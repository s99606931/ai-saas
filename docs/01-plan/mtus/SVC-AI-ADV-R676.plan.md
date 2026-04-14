# SVC-AI-ADV-R676 Plan — AI기반 공급망 리스크 분석 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공급업체 의존성 기반 공급망 리스크 정량 평가 |
| WHO | 보안팀, 조달팀 |
| RISK | N2SF C/S 등급 공급사 정보 외부 전송 금지 |
| SUCCESS | FR-R676.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/supply-chain-risk-ai-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R676.1 | 공급사 등록 (vendorId, name, criticality) |
| FR-R676.2 | 리스크 신호 평가 (dataGrade? C/S 차단) |
| FR-R676.3 | 리스크 등급 (HIGH/MEDIUM/LOW) |
| FR-R676.4 | 대응 권고 (REPLACE/MONITOR/ACCEPT) |
| FR-R676.5 | getAuditLog() append-only 감사 로그 |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
