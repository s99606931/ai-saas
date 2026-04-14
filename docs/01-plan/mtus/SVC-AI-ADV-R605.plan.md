# SVC-AI-ADV-R605 Plan — AI기반 공공기관 내부 감사 보고 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 내부 감사 결과를 자동 분석하여 시정 조치 우선순위 결정 지원 |
| WHO | 내부 감사 담당자, 감사원 |
| RISK | 감사 결과 오분류로 인한 중요 지적 사항 누락 방지 |
| SUCCESS | SC-R605-1: 감사 항목 수집 / SC-R605-2: 위험 분류 / SC-R605-3: 시정 권고 |
| SCOPE | internal-audit-reporter-v3.ts 구현 |

## 요구사항
- FR-R605.1: 입력 (auditId, agencyId, findings: {findingId, category, severity: 'CRITICAL'|'HIGH'|'MEDIUM'|'LOW', isRecurring: boolean}[])
- FR-R605.2: 각 지적 가중 심각도 (isRecurring이면 한 단계 상향: LOW→MEDIUM, MEDIUM→HIGH, HIGH→CRITICAL, CRITICAL 유지)
- FR-R605.3: 즉시 시정 필요 = 가중 심각도가 CRITICAL 또는 HIGH
- FR-R605.4: 감사 점수 = (1 - 즉시시정필요수/전체수) * 100 (전체수>0일 때, else 100)
- FR-R605.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R605.* ↔ `internal-audit-reporter-v3.ts` ↔ 테스트 ↔ CSAP D-06
