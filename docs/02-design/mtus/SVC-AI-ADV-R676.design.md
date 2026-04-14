# SVC-AI-ADV-R676 Design — AI기반 공급망 리스크 분석 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R676.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+ |
| 범위 | platform/services/ai-service/src/lib/supply-chain-risk-ai-v2.ts |

## 설계 결정
- `SupplyChainRiskAIV2` 클래스
- `registerVendor(vendor)`, `assessRisk(signal, grade)`: C/S 차단
- 리스크 점수: ≥70 HIGH / ≥40 MEDIUM / LOW
- 권고: HIGH→REPLACE / MEDIUM→MONITOR / LOW→ACCEPT
- vendor.criticality=HIGH 시 권고 한 단계 승격

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
