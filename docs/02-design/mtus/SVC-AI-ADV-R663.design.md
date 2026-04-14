# SVC-AI-ADV-R663 Design — AI기반 시맨틱 API 게이트웨이 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R663.1~6 구현 |
| 보안 | N2SF N-05, PII 마스킹, CSAP D-06 |
| 품질 | TypeScript strict, Vitest 6+ |
| 범위 | platform/services/ai-service/src/lib/semantic-api-gateway-v3.ts |

## 설계 결정
- `SemanticAPIGatewayV3` 클래스
- 점수 = (일치 키워드 수) / sqrt(API 키워드 수 * 발화 토큰 수)
- top-k 후보 정렬 반환
- 매칭 없을 시 빈 배열
- 마스킹: 이메일/전화/주민번호 정규식 → SHA-256 16자

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
