# SVC-AI-ADV-R513 Plan — AI기반 실시간 위협 분류기 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 보안 이벤트를 실시간으로 분류하여 CSAP D-06 침해사고 대응 자동화 |
| WHO | 보안 관제팀, CSAP 감사 담당자 |
| RISK | 위협 오분류로 인한 대응 지연 방지 |
| SUCCESS | SC-R513-1: 이벤트 수집 / SC-R513-2: 위협 유형 분류 / SC-R513-3: 대응 권고 |
| SCOPE | realtime-threat-classifier-v2.ts 구현 |

## 요구사항
- FR-R513.1: 이벤트 입력 (eventId, source, eventType, payload, grade: 'O'|'C'|'S')
- FR-R513.2: C/S 등급 차단 (throw BLOCKED)
- FR-R513.3: 위협 유형 분류 (SQL_INJECTION/XSS/BRUTE_FORCE/DDOS/UNKNOWN)
- FR-R513.4: 심각도 판정 (SQL_INJECTION/DDOS: CRITICAL, XSS/BRUTE_FORCE: HIGH, UNKNOWN: MEDIUM)
- FR-R513.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R513.* ↔ `realtime-threat-classifier-v2.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
