# SVC-AI-ADV-R617 Plan — AI기반 스마트계약 감사 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공 블록체인/DID 연동 보안 강화 |
| WHO | 블록체인 보안 담당자 |
| RISK | N2SF C/S 등급 데이터 외부 전송 금지 |
| SUCCESS | FR-R617.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/smart-contract-auditor-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R617.1 | 계약 소스 등록 |
| FR-R617.2 | N2SF 등급 검사 |
| FR-R617.3 | 정적 취약점 탐지 (reentrancy, tx.origin, unchecked send) |
| FR-R617.4 | 심각도 CRITICAL/HIGH/MEDIUM/LOW 판정 |
| FR-R617.5 | 감사 로그 getAuditLog() |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
