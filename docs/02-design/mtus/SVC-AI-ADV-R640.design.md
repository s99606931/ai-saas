# SVC-AI-ADV-R640 Design — AI기반 공문서 요약 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R640.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 감사 로그 |
| 품질 | TypeScript strict, Vitest 5+개 |
| 범위 | platform/services/ai-service/src/lib/document-summarizer-ai-v3.ts |

## 설계 결정
- 클래스 기반 단일 모듈 (DocumentSummarizerAiV3)
- 문서 Map<docId, { title, body, summary }>
- 요약은 body 첫 N문장 추출 방식 (O등급에서만 가능)
- 압축비율 = summary.length / body.length
- 긴 문서: body.length > threshold
- C/S 등급 즉시 throw (N2SF N-05)
- getAuditLog(): shallow copy

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-b |
