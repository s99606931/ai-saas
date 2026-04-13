# SVC-AI-ADV-R374 Design: 실시간 서비스 품질 보증

## SLA 상태
- measured <= target * 0.9 → WITHIN_SLA
- measured <= target → AT_RISK
- measured > target → SLA_BREACH

## 품질 레벨
- score = weighted(latency, successRate, errorRate)
- >= 90 → EXCELLENT, >= 75 → GOOD, >= 60 → ACCEPTABLE, >= 40 → POOR, else UNACCEPTABLE

## 감사
- sla.register, measurement.record, breach.detected
