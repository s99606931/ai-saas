# SVC-AI-ADV-R239 Plan: AI기반 실시간 이상 거래 탐지

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 금융 사기 거래 실시간 탐지로 피해 최소화 |
| WHO | 금융 보안 담당자, 리스크 관리팀 |
| RISK | 탐지 지연 시 대규모 금융 손실 |
| SUCCESS | LARGE_AMOUNT/UNUSUAL_HOUR/FOREIGN_LOCATION/VELOCITY 탐지 |
| SCOPE | ai-service 내 RealtimeTransactionAnomalyDetector 클래스 |

## 요구사항
- FR-R239.1: 거래 금액 통상 한도 3배 초과 → LARGE_AMOUNT CRITICAL 차단
- FR-R239.2: 비정상 시간대 거래 → UNUSUAL_HOUR MEDIUM
- FR-R239.3: 비통상 위치 + 큰 금액 → FOREIGN_LOCATION HIGH
- FR-R239.4: 1분 내 5건 이상 → VELOCITY HIGH 차단
- FR-R239.5: CSAP D-06 감사 로그
