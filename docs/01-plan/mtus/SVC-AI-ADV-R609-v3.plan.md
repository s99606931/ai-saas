# SVC-AI-ADV-R609 (v3) Plan — AI기반 API 보안 스캐너 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | API 엔드포인트의 보안 취약점 자동 스캔으로 OWASP Top10 대응 |
| WHO | 보안 담당자, API 운영팀 |
| RISK | 인증/HTTPS/Rate Limit 누락 탐지 누락 방지 |
| SUCCESS | SC-R609v3-1: 스캔 / SC-R609v3-2: 위험도 / SC-R609v3-3: 감사 |
| SCOPE | api-security-scanner-v3.ts 구현 (트랙 A 22차) |

## 기능 요구사항
- FR-R609v3.1: 입력 (endpoints: {id, path, method, hasAuth: boolean, hasHttps: boolean, hasRateLimit: boolean, hasInputValidation: boolean}[])
- FR-R609v3.2: 결함 탐지
  - !hasAuth → AUTH_MISSING (CRITICAL)
  - !hasHttps → HTTPS_MISSING (CRITICAL)
  - !hasInputValidation → INPUT_VALIDATION_MISSING (HIGH)
  - !hasRateLimit → RATE_LIMIT_MISSING (MEDIUM)
- FR-R609v3.3: 엔드포인트별 maxSeverity (CRITICAL>HIGH>MEDIUM>NONE)
- FR-R609v3.4: 전체 결과 = {totalEndpoints, criticalCount, highCount, mediumCount, items}
- FR-R609v3.5: 감사 로그

## 추적성
FR-R609v3.* ↔ `api-security-scanner-v3.ts` ↔ 테스트 ↔ CSAP D-08/D-12, OWASP Top10
