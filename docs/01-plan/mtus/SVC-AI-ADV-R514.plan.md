# SVC-AI-ADV-R514 Plan — AI기반 공공 서비스 접근성 평가 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공 서비스의 장애인·고령자 접근성을 자동 평가하여 개선 우선순위 도출 |
| WHO | 접근성 담당 공무원, 웹 접근성 검수팀 |
| RISK | 접근성 미달로 인한 법적 위반 방지 |
| SUCCESS | SC-R514-1: 항목 평가 / SC-R514-2: 등급 산출 / SC-R514-3: 개선 권고 |
| SCOPE | public-service-accessibility-assessor-v3.ts 구현 |

## 요구사항
- FR-R514.1: 서비스 입력 (serviceId, hasAltText, hasKeyboardNav, hasColorContrast, hasCaptionVideo, hasScreenReader)
- FR-R514.2: 점수 계산 (각 항목 20점, 최대 100점)
- FR-R514.3: 등급 분류 (>=80: A, >=60: B, >=40: C, else D)
- FR-R514.4: 미충족 항목 목록 반환 (missing)
- FR-R514.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R514.* ↔ `public-service-accessibility-assessor-v3.ts` ↔ 테스트 ↔ CSAP D-06
