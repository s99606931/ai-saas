# SVC-AI-ADV-R475 Plan — AI기반 공공 안전 위협 자동 탐지

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공 시설 및 인프라에 대한 위협 이벤트를 AI로 자동 탐지하여 선제 대응 지원 |
| WHO | 공공 안전 담당자, 보안관제 센터 |
| RISK | 위협 오탐/미탐으로 인한 안전 사고 방지 필요 |
| SUCCESS | SC-R475-1: 이벤트 수집 / SC-R475-2: 위협 수준 분류 / SC-R475-3: C/S 차단 |
| SCOPE | public-safety-threat-detector-ai.ts 구현 |

## 요구사항
- FR-R475.1: 이벤트 입력 (eventId, type, severity 0~1, location, timestamp)
- FR-R475.2: 위협 수준 분류 (severity>=0.8: CRITICAL, >=0.6: HIGH, >=0.4: MEDIUM, else LOW)
- FR-R475.3: C/S 등급 데이터 차단 (throw BLOCKED)
- FR-R475.4: PII 마스킹 (location의 개인 식별 정보 마스킹)
- FR-R475.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R475.* ↔ `public-safety-threat-detector-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
