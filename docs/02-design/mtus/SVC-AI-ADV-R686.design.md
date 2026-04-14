# SVC-AI-ADV-R686 Design — AI기반 규제 샌드박스 관리 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R686.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, sponsorEmail SHA-256 16자 마스킹 |
| 품질 | TypeScript strict, Vitest 6+ |
| 범위 | platform/services/ai-service/src/lib/regulatory-sandbox-ai-v2.ts |

## 설계 결정
- `RegulatorySandboxAIV2` 클래스
- `submitApplication(app, grade?)`: C/S→BLOCKED, sponsorEmail 마스킹
- 리스크 점수 = 0.4·consumerImpact + 0.4·legalRisk + 0.2·dataSensitivity
- HIGH/MEDIUM/LOW → REJECT/CONDITIONAL/APPROVE
- `getAuditLog()` 제공

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
