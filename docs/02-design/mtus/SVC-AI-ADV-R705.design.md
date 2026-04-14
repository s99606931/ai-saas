# SVC-AI-ADV-R705 Design — AI기반 정책 준수 검증 v4

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R705.1~5 구현 |
| 보안 | N2SF N-05 C/S 차단, resourceId sha256 16자, CSAP D-06 |
| 품질 | TypeScript strict, Vitest 6+ |
| 범위 | platform/services/ai-service/src/lib/policy-compliance-validator-v4.ts |

## 설계 결정
- `PolicyComplianceValidatorV4` 클래스
- 정책: {policyId, attribute, allowedValues[], severity: LOW|MEDIUM|HIGH}
- evaluate(resource): 모든 정책 순회 - attrs[attribute] not in allowedValues → 위반
- 리스크 점수: LOW=1, MEDIUM=3, HIGH=9, 합산
- listViolations(): severity 내림차순 정렬

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
