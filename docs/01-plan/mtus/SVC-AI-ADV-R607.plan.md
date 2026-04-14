# SVC-AI-ADV-R607 Plan — AI기반 공공기관 AI 거버넌스 강화 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | AI 시스템 사용의 투명성·공정성·책임성을 자동 평가하여 거버넌스 강화 |
| WHO | AI 거버넌스 위원회, 감사 담당자 |
| RISK | AI 편향·불투명성으로 인한 행정 불공정 방지 |
| SUCCESS | SC-R607-1: AI 사용 현황 수집 / SC-R607-2: 거버넌스 점수 산출 / SC-R607-3: 개선 권고 |
| SCOPE | ai-governance-enhancer-v2.ts 구현 |

## 요구사항
- FR-R607.1: 입력 (systemId, hasExplainability: boolean, hasBiasCheck: boolean, hasAuditLog: boolean, hasHumanOversight: boolean, dataGrade: 'C'|'S'|'O')
- FR-R607.2: 거버넌스 점수 = (hasExplainability?25:0)+(hasBiasCheck?25:0)+(hasAuditLog?25:0)+(hasHumanOversight?25:0)
- FR-R607.3: 등급 (>=75: COMPLIANT, >=50: PARTIAL, else NON_COMPLIANT)
- FR-R607.4: C/S 등급 AI 사용 시 hasExplainability+hasHumanOversight 모두 true 필수, 아니면 VIOLATION 플래그
- FR-R607.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R607.* ↔ `ai-governance-enhancer-v2.ts` ↔ 테스트 ↔ CSAP D-06, N-05
