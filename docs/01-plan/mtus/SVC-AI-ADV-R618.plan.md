# SVC-AI-ADV-R618 Plan — AI기반 양자내성 암호화 자문 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 양자 컴퓨팅 위협 대비 PQC 전환 전략 |
| WHO | 암호화/보안 아키텍트 |
| RISK | N2SF C/S 등급 데이터 외부 전송 금지 |
| SUCCESS | FR-R618.1~5 모두 충족 |
| SCOPE | platform/services/ai-service/src/lib/quantum-safe-crypto-advisor-v2.ts |

## 기능 요구사항
| ID | 요구사항 |
|----|---------|
| FR-R618.1 | 현재 암호 알고리즘 등록 |
| FR-R618.2 | N2SF 등급 검사 |
| FR-R618.3 | 양자취약/안전 분류 (RSA/ECC 취약, AES-256/ML-KEM 안전) |
| FR-R618.4 | PQC 대체 알고리즘 권장 |
| FR-R618.5 | 감사 로그 getAuditLog() |

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
