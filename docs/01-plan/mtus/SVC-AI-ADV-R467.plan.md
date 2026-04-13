# SVC-AI-ADV-R467 Plan — AI기반 공공 입력 자동 검증 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공 서비스 입력 데이터 품질을 자동 검증하여 오류 처리 비용 절감 |
| WHO | 공공 서비스 개발자, 품질팀 |
| RISK | 검증 규칙 변경 시 하위 호환성 유지 필요 |
| SUCCESS | SC-R467-1: 검증 규칙 등록 / SC-R467-2: 입력 검증 결과 / SC-R467-3: C/S 등급 차단 |
| SCOPE | public-input-validator-v2.ts 구현 |

## 요구사항
- FR-R467.1: 검증 규칙 등록 (ruleId, fieldName, ruleType: required/minLength/maxLength/pattern, ruleValue)
- FR-R467.2: 입력 검증 (fieldName → value)
- FR-R467.3: 검증 결과 (valid: boolean, errors: string[])
- FR-R467.4: 필드별 전체 규칙 적용
- FR-R467.5: N2SF N-05 C/S 등급 차단

## 추적성
FR-R467.* ↔ `public-input-validator-v2.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
