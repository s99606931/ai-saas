# SVC-AI-ADV-R653 Design — AI기반 기관 간 데이터 브로커 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R653.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+ |
| 범위 | platform/services/ai-service/src/lib/cross-agency-data-broker-v2.ts |

## 설계 결정
- `CrossAgencyDataBrokerV2` 클래스
- `request(exchange, grade)`: C/S 차단, requesterEmail SHA-256 16자 마스킹
- 결정: 동일 기관→ALLOW, 다른 기관+민감 필드→MASK, 차단 리스트→DENY
- 차단 리스트: ['ssn', 'password', 'creditCard']

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
