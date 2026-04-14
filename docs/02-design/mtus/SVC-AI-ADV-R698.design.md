# SVC-AI-ADV-R698 Design — AI기반 공공 API 보안 강제화 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R698.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, PII sha256 마스킹, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+ |
| 범위 | platform/services/ai-service/src/lib/public-api-security-enforcer-v3.ts |

## 설계 결정
- `PublicApiSecurityEnforcerV3` 클래스
- `registerPolicy(p)`, `evaluateRequest(req, grade)`: C/S 차단
- 위반 점수 = (!auth && requireAuth ? 50 : 0) + (rps > maxRps ? 30 : 0) + (!tls ? 20 : 0)
- ≥ 70 BLOCK / ≥ 30 WARN / ALLOW
- clientId sha256 16자 마스킹

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
