# SVC-AI-ADV-R654 Design — AI기반 선제적 보안 패치 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R654.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+ |
| 범위 | platform/services/ai-service/src/lib/proactive-security-patching-ai-v2.ts |

## 설계 결정
- `ProactiveSecurityPatchingAIV2` 클래스
- `registerAsset(asset)`, `reportVulnerability(vuln, grade)`: C/S 차단
- CVSS 등급: ≥9.0 CRITICAL / ≥7.0 HIGH / ≥4.0 MEDIUM / LOW
- 권고: CRITICAL→IMMEDIATE / HIGH→IMMEDIATE / MEDIUM→SCHEDULED / LOW→MONITOR
- exploitAvailable=true 시 권고 한 단계 승격

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
