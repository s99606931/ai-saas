# SVC-AI-ADV-R404 Design: SLA Enforcer

## 입력
- { slaId, target, actual, basePenalty }

## 계산
- ratio = clip((target - actual) / target, 0, 1)
  - target이 "높을수록 좋음" (e.g. uptime): actual < target이면 위반
- penalty = round(basePenalty * ratio)
- level:
  - ratio === 0 → 'none'
  - ratio < 0.15 → 'L1'
  - ratio < 0.30 → 'L2'
  - ratio >= 0.30 → 'L3'
