# SVC-AI-ADV-R264 Design — 시민 민원 품질 점수 엔진

> 2026-04-13

## Design Anchor
- Plan: SVC-AI-ADV-R264.plan.md
- Impl: `civic-service-quality-engine.ts`

## 지표 계산

### responseScore (30%)
```
hours = (respondedAt - submittedAt) / 3600000
if hours <= 24:     100
elif hours <= 48:    80
elif hours <= 168:   50
else:                 0
```

### resolutionRate (30%)
resolvedAt != null 이면 100, 없으면 0 (평균)

### reinquiryScore (20%, 역지표)
```
score = max(0, 100 - reinquiryCount * 25)
```

### satisfactionScore (20%)
```
(satisfaction - 1) / 4 * 100  // 1~5 → 0~100
null 이면 해당 민원 제외 (카운트 X)
```

### 총점
```
total = resp*0.3 + resol*0.3 + reinq*0.2 + satis*0.2
```

## Grade

| score | grade |
|-------|-------|
| ≥90 | EXCELLENT |
| ≥75 | GOOD |
| ≥60 | FAIR |
| <60 | POOR |

## 권고 생성

지표별 60점 미만이면 `응답 속도 개선 필요 (현재 XX점)` 권고 추가
