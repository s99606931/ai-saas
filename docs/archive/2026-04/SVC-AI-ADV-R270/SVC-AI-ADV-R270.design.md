# SVC-AI-ADV-R270 — 설계

## 아키텍처

```
ingestEvent({timestamp, sourceIp, eventType})
correlate(windowMs=300000) → Group[]
  → 같은 sourceIp + 윈도우 내 이벤트
classifyThreat(group) → Pattern | null
  - LOGIN_FAIL >= 5 → BRUTE_FORCE HIGH
  - PORT_SCAN >= 3 → SCANNING MED
  - PRIV_ESC >= 1 → PRIV_ESC CRITICAL
  - MIXED → 복합 공격 HIGH
```

## 보안

- sourceIp 마지막 옥텟 마스킹: 192.168.1.* 
- 모든 상관분석 결과 감사 기록
