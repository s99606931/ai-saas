# SVC-AI-ADV-R567 Plan — AI기반 공공기관 정보 자산 관리

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 정보 자산 보안 등급과 위험도를 자동 평가하여 보호 조치 우선순위 결정 |
| WHO | 정보보안 담당자, CISO |
| RISK | 등급 오분류로 인한 민감 자산 노출 방지 |
| SUCCESS | SC-R567-1: 자산 등록 / SC-R567-2: 위험 평가 / SC-R567-3: 보호 조치 권고 |
| SCOPE | info-asset-manager-ai.ts 구현 |

## 요구사항
- FR-R567.1: 입력 (assetId, assetName, dataGrade: 'C'|'S'|'O', exposureLevel: number 0~10, lastAuditDays: number)
- FR-R567.2: 위험 점수 = (dataGrade==='C'?40: dataGrade==='S'?30:10) + exposureLevel×3 + min(lastAuditDays/365,1)×30
- FR-R567.3: 위험 등급 (>=70: CRITICAL, >=50: HIGH, >=30: MEDIUM, else LOW)
- FR-R567.4: 권고 조치 (CRITICAL: IMMEDIATE_AUDIT, HIGH: SCHEDULE_AUDIT, MEDIUM: MONITOR, LOW: ROUTINE)
- FR-R567.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R567.* ↔ `info-asset-manager-ai.ts` ↔ 테스트 ↔ CSAP D-06, N-05
