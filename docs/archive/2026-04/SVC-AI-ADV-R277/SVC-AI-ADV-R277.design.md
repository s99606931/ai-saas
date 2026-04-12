# SVC-AI-ADV-R277 — 설계

## 구조

```
defineKpi({kpiId, name, target, direction: 'UP'|'DOWN'})
recordMeasurement(kpiId, period, value)
evaluate(kpiId) → {latestValue, target, achievementPct, status, trend}
  status:
    - UP: >=100% ON_TRACK, >=80% AT_RISK, <80% OFF_TRACK
    - DOWN: <=target ON_TRACK, <=target*1.2 AT_RISK, else OFF_TRACK
  trend: 마지막 3개 선형 추세
```
