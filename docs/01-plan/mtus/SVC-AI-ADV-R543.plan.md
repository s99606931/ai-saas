# SVC-AI-ADV-R543 Plan — 공공문서 진위 검증

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 위조 공문서 제출 방지 및 전자 행정 신뢰성 확보 |
| WHO | 민원 담당 공무원, 감사 기관 |
| RISK | 진위 오탐으로 인한 정상 문서 거부 방지 |
| SUCCESS | SC-R543-1: 문서 수집 / SC-R543-2: 진위 판정 / SC-R543-3: 감사 기록 |
| SCOPE | public-document-authenticity-verifier.ts 구현 |

## 요구사항
- FR-R543.1: 입력 (documentId, issuedBy, issuedAt, checksum, requiredFields: string[], presentFields: string[])
- FR-R543.2: 필드 완전성 = requiredFields가 모두 presentFields에 포함 여부
- FR-R543.3: 체크섬 검증 = checksum이 16자 이상 hex 문자열 여부 (^[0-9a-fA-F]{16,}$)
- FR-R543.4: 판정 (필드완전+체크섬유효: AUTHENTIC, 필드불완전: INCOMPLETE, 체크섬무효: TAMPERED)
- FR-R543.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R543.* ↔ `public-document-authenticity-verifier.ts` ↔ 테스트 ↔ CSAP D-06
