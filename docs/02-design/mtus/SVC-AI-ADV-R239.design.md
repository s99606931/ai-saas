# SVC-AI-ADV-R239 Design: AI기반 실시간 이상 거래 탐지

## 구현 파일
`platform/services/ai-service/src/lib/realtime-transaction-anomaly-detector.ts`

## 핵심 설계
- `TransactionProfile`: typicalMaxAmount, typicalHours[], typicalLocation
- `detect()` 우선순위: LARGE_AMOUNT → UNUSUAL_HOUR → FOREIGN_LOCATION → VELOCITY
- LARGE_AMOUNT: amount > typicalMaxAmount × 3 → CRITICAL, blocked=true
- VELOCITY: 60초 윈도우 내 ≥ 5건 → HIGH, blocked=true
- 감사 로그: `profile.register`, `anomaly.detected`
