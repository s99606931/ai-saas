# SVC-AI-ADV-R664 Design — AI기반 로그 자동 파싱 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R664.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, PII SHA-256 마스킹, CSAP D-06 감사 |
| 품질 | TypeScript strict, Vitest 5+ |
| 범위 | platform/services/ai-service/src/lib/ai-powered-log-parser-v3.ts |

## 설계 결정
- `AIPoweredLogParserV3` 클래스, `parse(line, dataGrade?)` 단일 메서드
- 정규식으로 timestamp/level/message 추출 (실패 시 UNKNOWN)
- 심각도 매핑: DEBUG/INFO/WARN/ERROR/FATAL 외 → INFO
- PII 마스킹: 이메일 / IPv4 정규식 → SHA-256 16자 hex
- audit log: PARSE_LOG action

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
