# SVC-AI-ADV-R431 Plan — Resident Registration Auto Reviewer AI

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 주민등록 변경/발급 신청 자격 자동 판정으로 민원 처리 시간 단축 |
| WHO | 행정안전부, 시·군·구청 민원실 |
| WHAT | 신청서 데이터 → 자격 요건 검증 → 승인/보류/반려 판정 |
| HOW | 필수 필드 + 증빙 + 거주 요건 규칙 엔진 |

## Context Anchor
- WHY: 창구 적체 해소, 민원인 재방문 감소
- WHO: 주민등록 담당 공무원
- RISK: 오판정 시 행정 오류 → 증빙 재확인 플래그 필수
- SUCCESS: 자동 승인율 60%+, 오판정률 < 1%
- SCOPE: `resident-registration-reviewer-ai.ts`

## 요구사항
- FR-431.1: 필수 필드(이름, 주민번호, 주소, 사유, 증빙) 누락 시 'REJECTED'
- FR-431.2: 주민번호 형식 (######-#######) 검증
- FR-431.3: 거주 요건 (이전 등록 후 30일 경과) 미충족 시 'HOLD'
- FR-431.4: 모든 요건 충족 + 증빙 2개 이상 → 'APPROVED'
- FR-431.5: N2SF C/S 차단 (주민번호=S등급) + `getAuditLog()`

## 추적성
FR-431.* ↔ `resident-registration-reviewer-ai.ts` ↔ 테스트 ↔ CSAP D-06/D-08 N2SF N-05
