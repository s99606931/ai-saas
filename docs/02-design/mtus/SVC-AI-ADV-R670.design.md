# SVC-AI-ADV-R670 Design — AI기반 데이터 보존 정책 자동화 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R670.1~5 구현 |
| 보안 | N2SF N-05 차단, owner SHA-256, CSAP D-06 감사 |
| 품질 | TypeScript strict, Vitest 5+ |
| 범위 | platform/services/ai-service/src/lib/data-retention-policy-ai-v3.ts |

## 설계 결정
- `DataRetentionPolicyAIV3` 클래스
- 보존기간(일): audit=365, health=1095, citizen=1825, temp=30
- `evaluate({category, createdAt, recordOwner}, dataGrade?)` → { retentionDays, expired, maskedOwner }
- audit action: EVALUATE_RETENTION

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
