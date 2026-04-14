# SVC-AI-ADV-R655 Design — AI기반 SLA 협상 자동화 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R655.1~6 구현 |
| 보안 | N2SF N-05 C/S 차단, PII SHA-256 마스킹, CSAP D-06 |
| 품질 | TypeScript strict, Vitest 5+ |
| 범위 | platform/services/ai-service/src/lib/ai-driven-sla-negotiator-v2.ts |

## 설계 결정
- `AIDrivenSLANegotiatorV2` 클래스
- `proposeSLA(proposal, grade)` C/S 차단
- 점수 = 0.4*availability + 0.3*(1 - responseMs/maxMs) + 0.3*(1 - price/maxPrice)
- 합의 판정: 점수 ≥ 0.7 AND 양측 acceptedBy 표시
- 담당자 이메일/이름 → maskPII

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
