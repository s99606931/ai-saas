# MTU Plan — SVC-AI-ADV-R151 Document Redaction Engine

> **원 요청 번호**: R151
> **모듈**: `platform/services/ai-service/src/lib/document-redaction-engine.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 문서 자동 마스킹(개인정보·비밀등급) → 유출 사고 방지 |
| 기술 | 정규식 기반 PII 감지 + 비밀등급 키워드 → `[REDACTED:type]` 치환 |
| 보안 | 주민번호/계좌/이메일/전화/여권/운전면허 동시 처리 |
| 규제 | 개인정보보호법, CSAP D-09, N2SF |

## Context Anchor

- WHY: AI 전송 전 PII 제거 필수. 기존 개별 마스커들을 통합 엔진화
- WHO: AI Gateway, 문서 업로드 API
- RISK: 민감정보 외부 전송 시 법적 제재
- SUCCESS: 모든 PII 타입 감지 + 치환 + 감사 로그 남김
- SCOPE: redact(text) → { redacted, hits[] }

## FR

| ID | 설명 |
|----|------|
| FR-R151.1 | 주민번호 감지: `\d{6}-\d{7}` → `[REDACTED:rrn]` |
| FR-R151.2 | 이메일 감지 → `[REDACTED:email]` |
| FR-R151.3 | 전화번호 감지 (010-xxxx-xxxx / 02-xxx-xxxx) → `[REDACTED:phone]` |
| FR-R151.4 | 계좌번호 감지 (6~14자리 숫자 - 구분자) → `[REDACTED:account]` |
| FR-R151.5 | 비밀등급 키워드 (`대외비`, `기밀`, `CONFIDENTIAL`) → `[REDACTED:classified]` |
| FR-R151.6 | 여권번호 (`M12345678`) → `[REDACTED:passport]` |
| FR-R151.7 | RedactResult(redacted, hits[], totalHits) |
| FR-R151.8 | 감사 로그 + C/S 차단 + 빈 텍스트 거부 |

## 테스트 케이스

- 주민번호 마스킹
- 이메일 마스킹
- 전화번호 마스킹 (010 / 02 / 0xx)
- 계좌번호 마스킹
- 비밀등급 키워드 마스킹
- 여권번호 마스킹
- 복수 타입 동시 감지
- 원문 유지 (hits만 기록)
- 빈 입력 거부
- C/S 차단
- getAuditLog
