# SVC-AI-ADV-R608 (v3) Plan — AI기반 문서 생명주기 관리 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 문서 보존 기간/접근 빈도 기반 자동 분류로 보존·폐기 정책 자동화 |
| WHO | 기록물 관리자, 감사 담당 |
| RISK | 보존 의무 문서 폐기 방지 |
| SUCCESS | SC-R608v3-1: 단계 분류 / SC-R608v3-2: 폐기 후보 / SC-R608v3-3: 감사 |
| SCOPE | document-lifecycle-manager-v3.ts 구현 (트랙 A 22차) |

## 기능 요구사항
- FR-R608v3.1: 입력 (docs: {id, createdAt: ISO, retentionYears, accessCount, classification: 'PERMANENT'|'STANDARD'}[])
- FR-R608v3.2: ageYears = (now - createdAt)/365일
- FR-R608v3.3: 단계
  - classification='PERMANENT' → ARCHIVE
  - ageYears >= retentionYears → DISPOSAL
  - ageYears >= retentionYears * 0.8 → REVIEW
  - else → ACTIVE
- FR-R608v3.4: 폐기 후보 = stage='DISPOSAL'인 항목 ID 목록
- FR-R608v3.5: 감사 로그

## 추적성
FR-R608v3.* ↔ `document-lifecycle-manager-v3.ts` ↔ 테스트 ↔ 공공기록물법
